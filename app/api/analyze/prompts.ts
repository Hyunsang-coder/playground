// Prompt builder functions — ported from backend/analyzer.py
// All prompts are in Korean, requiring pure JSON output from Claude.

import type {
  WebSearchResult,
  GitHubSearchResult,
  FeasibilityResult,
  DifferentiationResult,
  DataAvailabilityResult,
  Bottleneck,
} from "./utils";

function getSignalCounts(competitors: WebSearchResult, githubResults: GitHubSearchResult) {
  const webRelevantCount = competitors.raw_count || competitors.competitors.length || 0;
  const githubRelevantCount = githubResults.repos.length || 0;
  const githubBroadCount = githubResults.total_count || 0;
  return { webRelevantCount, githubRelevantCount, githubBroadCount };
}

export function buildSearchQueriesPrompt(idea: string): string {
  return `사용자의 아이디어를 기반으로 경쟁 제품과 유사 프로젝트를 찾기 위한 최적의 검색 키워드를 생성하세요.

아이디어: ${idea}

반드시 순수 JSON으로만 응답하세요:

{
  "web_queries": ["영어 웹 검색 쿼리 1", "영어 웹 검색 쿼리 2"],
  "github_queries": ["GitHub 검색 쿼리 1 (핵심 기능 중심)", "GitHub 검색 쿼리 2 (상위 카테고리/대안 키워드)"]
}

규칙:
- web_queries: 정확히 2개의 영어 검색 쿼리. 첫 번째는 일반 검색, 두 번째는 경쟁 제품 검색
- github_queries: 정확히 2개. 첫 번째는 핵심 기능을 직접 표현하는 2~4단어 키워드, 두 번째는 더 넓은 카테고리나 유사 도메인 키워드
  - 예시 (아이디어: "쿠팡 리뷰 분석기"): ["coupang review analyzer", "ecommerce review sentiment"]
  - 예시 (아이디어: "AI 코드 리뷰 봇"): ["ai code review bot", "automated code review github"]
- 핵심 기술과 도메인을 반영할 것
- 한국어 아이디어는 반드시 영어로 번역하여 검색 쿼리 생성`;
}

export function buildRefineSearchQueriesPrompt(idea: string, currentResults: { title: string }[]): string {
  const resultsSummary =
    currentResults.slice(0, 5).map((c) => `- ${c.title}`).join("\n") || "결과 없음";

  return `초기 검색 결과가 부실합니다. 더 나은 검색 쿼리를 생성하세요.

아이디어: ${idea}
현재 검색 결과 (${currentResults.length}개):
${resultsSummary}

반드시 순수 JSON으로만 응답하세요:
{"queries": ["개선된 영어 검색 쿼리 1", "개선된 영어 검색 쿼리 2"]}

규칙:
- 이전 쿼리와 다른 각도로 검색할 것
- 더 넓은 키워드 또는 유사 도메인으로 검색
- 동의어, 상위 카테고리, 관련 기술 활용`;
}

export function buildFilterRelevantPrompt(idea: string, competitors: { title: string; snippet: string }[]): string {
  const itemsText = competitors
    .map((c, i) => `${i}. ${c.title} — ${c.snippet.slice(0, 100)}`)
    .join("\n");

  return `아이디어: ${idea}

아래 검색 결과에서 실제 경쟁 제품/서비스/도구인 것만 골라주세요.
뉴스 기사, 블로그 포스트, 튜토리얼, 문서 등은 제외하세요.
반드시 관련도 높은 순서대로 인덱스를 정렬하세요.

${itemsText}

반드시 순수 JSON으로만 응답하세요:
{"relevant_indices": [0, 2, 5]}`;
}

export function buildDataExtractionPrompt(idea: string): string {
  return `아이디어에서 구현에 필요한 외부 데이터 소스와 npm 라이브러리를 추출하세요.

아이디어: ${idea}

규칙:
- data_sources: 외부 서비스/플랫폼 데이터 (최대 3개)
  - name: 데이터 소스명 (영어)
  - search_queries: 해당 소스의 API/접근 가능성을 확인할 검색 쿼리 3개 (영어 2개 + 한국어 1개)
    - 첫 번째: 공식 API 문서 검색 (예: "coupang open API developer documentation")
    - 두 번째: 개발자 포털/가격 검색 (예: "coupang developer portal pricing free tier")
    - 세 번째: 한국어 개발자 가이드 검색 (예: "쿠팡 오픈API 개발자 가이드")
- libraries: 가능한 한 실제 npm 패키지명으로 작성 (최대 3개, 영어)
  예) "@tiptap/react", "pptxgenjs", "cheerio"
  정확한 패키지명을 모르면 "category:<설명>" 형식 사용
- React/Next.js/TypeScript 같은 범용 의존성 제외
- 아이디어에 명확히 필요한 것만 포함

반드시 순수 JSON으로만 응답:
{
  "data_sources": [
    {"name": "Coupang product reviews", "search_queries": ["coupang open API developer", "coupang developer portal pricing", "쿠팡 오픈API 가이드"]}
  ],
  "libraries": ["cheerio"]
}`;
}

export function buildDataJudgmentPrompt(
  dataSources: string[],
  libraries: string[],
  evidence: Record<string, { urls: string[]; snippets: string[] }>
): string {
  const evidenceText = Object.entries(evidence)
    .map(([query, result]) => {
      const urls = result.urls.length > 0 ? result.urls.map((u) => `- ${u}`).join("\n") : "- (없음)";
      const snippets = result.snippets.length > 0
        ? result.snippets.map((s) => `- ${s}`).join("\n")
        : "- (없음)";
      return `[Query] ${query}\nURLs:\n${urls}\nSnippets:\n${snippets}`;
    })
    .join("\n\n");

  return `당신은 실무 구현 가능성 검증 전문가입니다.
아래 Tavily 검색 증거(URL + snippet)를 바탕으로 데이터/API 및 npm 라이브러리 가용성을 판정하세요.

데이터 소스 후보:
${JSON.stringify(dataSources)}

라이브러리 후보:
${JSON.stringify(libraries)}

검색 증거:
${evidenceText}

판단 규칙:
- has_official_api: 공개된 공식 API 문서/포털이 실제로 존재하면 true
- crawlable: 공식 API가 없어도 공개 웹사이트에서 데이터 추출 가능하면 true
- blocking: API도 없고 크롤링도 현실적으로 어렵거나 법적/권한 제약으로 불가능하면 true
- note: 반드시 근거 문구를 반영해 한 줄로 작성
- evidence_url: 가장 신뢰 가능한 근거 URL 하나

중요 기준:
- "closed beta", "contact us", "requires partnership" => blocking=true
- "free tier", "get API key", "open API" => has_official_api=true
- 공개 웹사이트가 있고 기술적으로 수집 가능 => crawlable=true
- npmjs.com 패키지 URL이 확인되면 available_on_npm=true, package_name 채우기

반드시 순수 JSON으로만 응답하세요:
{
  "data_sources": [
    {
      "name": "string",
      "has_official_api": true,
      "crawlable": false,
      "evidence_url": "https://...",
      "blocking": false,
      "note": "근거 요약"
    }
  ],
  "libraries": [
    {
      "name": "string",
      "available_on_npm": true,
      "package_name": "string",
      "note": "근거 요약"
    }
  ],
  "has_blocking_issues": false
}`;
}

export function buildFeasibilityPrompt(
  idea: string,
  dataAvailability?: DataAvailabilityResult
): string {
  let dataSection = "";
  if (dataAvailability && (dataAvailability.data_sources.length > 0 || dataAvailability.libraries.length > 0)) {
    const sourceLines = dataAvailability.data_sources
      .map((s) => {
        const status = s.has_official_api
          ? "공식 API 확인됨"
          : s.crawlable
            ? "공식 API 없음, 크롤링 가능"
            : "API 없음, 크롤링 불가 (블로커)";
        return `- ${s.name}: ${status} — ${s.note}`;
      })
      .join("\n");

    const libLines = dataAvailability.libraries
      .map((l) =>
        `- ${l.name}: ${l.available_on_npm
          ? `npm/${l.package_name || l.name} 존재`
          : "npm 패키지 없음, 직접 구현 필요"} — ${l.note}`
      )
      .join("\n");

    const blockingNote = dataAvailability.has_blocking_issues
      ? "중요: 위 조사 결과에 블로킹 이슈가 존재합니다. 반드시 overall_feasibility와 vibe_coding_difficulty에 반영하세요. has_blocking_issues=true이면 overall_feasibility는 \"difficult\", vibe_coding_difficulty는 \"hard\"여야 합니다."
      : "블로킹 이슈 없음. 위 조사 결과를 feasibility 판단에 긍정적으로 반영하세요.";

    dataSection = `\n[사전 실증 조사 결과 — 반드시 아래 사실을 기반으로 분석하세요]\n외부 데이터 소스:\n${sourceLines || "- 없음"}\nnpm 라이브러리:\n${libLines || "- 없음"}\n${blockingNote}\n`;
  }

  return `당신은 바이브코딩(AI 어시스턴트와 함께 코딩하는 환경) 실현성을 냉정하게 분석하는 시니어 개발자입니다.

${dataSection}
아이디어: ${idea}
개발 환경: 제한된 시간의 1인 바이브코딩

다음을 분석해주세요:

1. 바이브코딩 난이도:
   - easy(쉬움): CRUD, Claude API 호출, 단순 UI
   - medium(보통): 파일 파싱, 외부 API 1~2개 연동
   - hard(어려움): WebSocket, 실시간 동기화, 복잡한 인증, 이진 파일 처리

2. 병목 지점: AI가 틀리거나 막힐 가능성이 높은 구체적인 기능 2~3개
   - crawlable=true인 데이터 소스는 블로커가 아닙니다.
   - 이 경우 type은 api_unavailable, severity는 medium으로 작성하세요.

3. 외부 의존성 리스크:
   - 인증 필요 여부 (시간 블랙홀 위험)
   - 실시간 데이터 필요 여부
   - 유료 API 의존 여부

4. 단기 개발 사이클(수시간~주말) 맥락에서의 실현 가능성 총평

score 및 overall_feasibility 산정 기준 (반드시 준수, 두 값은 반드시 일치해야 합니다):
- score 70~100 → overall_feasibility: "possible"
- score 40~69  → overall_feasibility: "partial"
- score 0~39   → overall_feasibility: "difficult"
- high severity 병목이 핵심 기능에 직결되는 경우: score ≤ 60 (즉 "partial" 이하)
- high severity 병목이 2개 이상인 경우: score ≤ 50 (즉 "partial" 이하)
- high severity 병목이 없는 경우: score는 다른 요소로 자유롭게 산정

반드시 순수 JSON으로만 응답하세요:

{
  "overall_feasibility": "possible" | "partial" | "difficult",
  "score": 0-100,
  "vibe_coding_difficulty": "easy" | "medium" | "hard",
  "bottlenecks": [
    {
      "type": "api_unavailable|auth_complexity|data_structure_unknown|realtime_required|no_library|complex_algorithm|binary_processing",
      "description": "구체적 기능명",
      "severity": "high|medium",
      "suggestion": "대안 또는 우회 방법"
    }
  ],
  "tech_requirements": [
    {"name": "기술/API명", "available": true/false, "difficulty": "easy|medium|hard", "note": "한줄 설명"}
  ],
  "key_risks": ["리스크 1", "리스크 2"],
  "time_estimate": "예상 개발 시간",
  "summary": "한줄 종합 판단"
}`;
}

export function buildDifferentiationPrompt(
  idea: string,
  competitors: WebSearchResult,
  githubResults: GitHubSearchResult
): string {
  const { webRelevantCount, githubRelevantCount, githubBroadCount } = getSignalCounts(
    competitors,
    githubResults
  );
  const competitorList =
    competitors.competitors
      .slice(0, 5)
      .map((c) => `- ${c.title}: ${c.snippet}`)
      .join("\n") || "발견된 경쟁 제품 없음";

  const githubList =
    githubResults.repos
      .slice(0, 5)
      .map((r) => `- ${r.name} (⭐${r.stars}): ${r.description}`)
      .join("\n") || "발견된 유사 프로젝트 없음";

  return `당신은 실리콘밸리의 가장 까칠하고 냉철한 벤처 캐피털리스트(VC)이자, 20년 경력의 시니어 풀스택 개발자입니다.

사용자의 아이디어를 다음 세 가지 관점에서 무자비하게 비판하세요:

1. "이미 똑같은 오픈소스가 있는데?" (Redundancy): 아래 경쟁 제품/GitHub 프로젝트를 완벽히 숙지하시고, 95% 이상 일치하는 '완제품'이나 '보일러플레이트' 저장소가 존재하는지 판단하세요. 만약 존재한다면 is_exact_match_found를 true로 설정하세요. "그냥 이거 Fork 해서 쓰면 되는 거 아냐?"라는 시각으로 접근하세요.
2. "이게 되겠어?" (Feasibility): "이건 개발자 자기만족 아냐?" 혹은 "사용자가 굳이 이걸 쓸 이유가 없어"라는 관점과 함께 제한된 리소스 내 기술적 핏을 지적하세요.
3. "누가 써?" (Market Fit): 뾰족한 타겟팅 없이 단순 추상화된 아이디어들의 실질적 고객 유치 어려움을 지적하세요.

정중하지만 뼈 때리는 말투로, 불필요한 수식어 없이 핵심 약점을 서술하세요.

아이디어: ${idea}
정량 신호:
- 웹 유의미 경쟁 후보: ${webRelevantCount}개
- GitHub 유의미 유사 저장소: ${githubRelevantCount}개
- GitHub 전체 검색 모수(참고): ${githubBroadCount}개

경쟁 제품:
${competitorList}

GitHub 유사 프로젝트:
${githubList}

중요:
- "유의미 후보 수"를 1차 근거로 사용하세요.
- is_exact_match_found 는 오직 제공된 GitHub 프로젝트 중 하나가 사용자의 아이디어를 95% 이상 그대로 커버할 때만 true입니다. 유사한 수준이면 false입니다.

competition_score 산정 기준 (반드시 준수):
- competition_score는 "경쟁이 적을수록 높은 점수" 입니다. 즉 경쟁이 치열할수록 낮은 점수입니다.
- blue_ocean  → competition_score: 70~100
- moderate    → competition_score: 40~69
- red_ocean   → competition_score: 0~39
- competition_level과 competition_score는 반드시 위 범위 안에서 일치해야 합니다.

반드시 순수 JSON으로만 응답하세요:

{
  "competition_level": "blue_ocean" | "moderate" | "red_ocean",
  "competition_score": 0-100,
  "existing_solutions": [
    {"name": "제품/프로젝트명", "similarity": 0-100, "weakness": "약점"}
  ],
  "unique_angles": ["차별화 포인트 1", "차별화 포인트 2"],
  "is_exact_match_found": boolean,
  "summary": "한줄 종합 (뼈 때리는 한마디)"
}`;
}

export function buildVerdictPrompt(
  idea: string,
  context: {
    enabledSteps: number[];
    competitors?: WebSearchResult;
    githubResults?: GitHubSearchResult;
    feasibility?: FeasibilityResult;
    differentiation?: DifferentiationResult;
    dataAvailability?: DataAvailabilityResult;
  }
): string {
  const {
    enabledSteps,
    competitors,
    githubResults,
    feasibility,
    differentiation,
    dataAvailability,
  } = context;

  const hasCompetitionData = Boolean(competitors) || Boolean(githubResults);
  const competitionMetrics = hasCompetitionData
    ? (() => {
      const c = competitors || { competitors: [], raw_count: 0, summary: "" };
      const g = githubResults || { repos: [], total_count: 0, summary: "" };
      const { webRelevantCount, githubRelevantCount, githubBroadCount } = getSignalCounts(c, g);
      return `경쟁 현황:
- 웹 유의미 경쟁 후보: ${webRelevantCount}개
- GitHub 유의미 유사 저장소: ${githubRelevantCount}개
- GitHub 전체 검색 모수(참고): ${githubBroadCount}개`;
    })()
    : "경쟁 현황: (미선택)";

  const highSeverityBottlenecks = feasibility
    ? (feasibility.bottlenecks || []).filter(
        (b): b is Bottleneck =>
          typeof b === "object" && b !== null && (b as Bottleneck).severity === "high"
      )
    : [];

  const feasibilitySection = feasibility
    ? `기술 실현성:
- 점수: ${feasibility.score ?? 50}/100 (이 값을 scores.feasibility에 그대로 사용하세요)
- 판정: ${feasibility.overall_feasibility || "unknown"}
- 핵심 리스크: ${JSON.stringify(feasibility.key_risks || [])}
- high severity 병목 (${highSeverityBottlenecks.length}개): ${
        highSeverityBottlenecks.length > 0
          ? highSeverityBottlenecks.map((b) => `[${b.type}] ${b.description}`).join(" / ")
          : "없음"
      }`
    : "기술 실현성: (미선택)";

  const differentiationSection = differentiation
    ? `차별화:
- 경쟁 수준: ${differentiation.competition_level || "unknown"}
- 경쟁 점수: ${differentiation.competition_score ?? 50}/100 (높을수록 경쟁이 적고 유리 — scores.competition에 그대로 사용하세요)
- 95% 이상 일치하는 보일러플레이트/완제품 OSS 발견 여부: ${differentiation.is_exact_match_found ? "예 (강력한 Fork/Clone 권장)" : "아니오"}
- 차별화 포인트: ${JSON.stringify(differentiation.unique_angles || [])}`
    : "차별화: (미선택)";

  const dataSummary = dataAvailability
    ? `\n데이터/API 가용성:\n- has_blocking_issues: ${String(dataAvailability.has_blocking_issues)}\n- data_sources: ${JSON.stringify(dataAvailability.data_sources)}\n- libraries: ${JSON.stringify(dataAvailability.libraries)}`
    : "";

  return `당신은 단기 개발 아이디어 심판관입니다. 최신 AI 코딩 어시스턴트(바이브코딩)를 활용해 1인 개발을 진행하려는 초중급 개발자 관점에서 최종 판정을 내리세요.

아이디어: ${idea}
선택된 단계: ${enabledSteps.join(", ")}

${competitionMetrics}
${feasibilitySection}
${differentiationSection}
${dataSummary}

반드시 순수 JSON으로만 응답하세요:

{
  "verdict": "GO" | "PIVOT" | "KILL" | "FORK",
  "confidence": 0-100,
  "overall_score": 0-100,
  "scores": {
    "competition": 0-100,
    "feasibility": 0-100,
    "differentiation": 0-100,
    "timing": 0-100
  },
  "one_liner": "한 줄 판정 이유",
  "recommendation": "1~2문장 이내의 간결한 추천 행동",
  "alternative_ideas": ["대안 1 (10자 이내 키워드)", "대안 2", "대안 3"]
}

주의 및 중요 규칙:
- [FORK 판정]: '차별화' 섹션에 "95% 이상 일치하는 보일러플레이트/완제품 OSS 발견 여부"가 "예"로 되어있다면, 바닥부터 바이브코딩을 할 필요가 없습니다. 무조건 verdict를 "FORK" 혹은 "KILL"로 지정하고 "이 오픈소스를 Fork/Clone 해서 시작하세요"라고 강하게 권고하세요.
- [VIBE-CODING 관점]: '기술 실현성'에서 병목 갯수, 데이터수집 한계가 높다면 AI 툴만 믿고 시작했다가 시간만 날릴 위험이 큽니다. 단기 성과를 위해 PIVOT을 제안하세요.
- 제공되지 않은(미선택) 단계 정보는 절대 추정하지 말고 평가에서 제외하세요.
- overall_score는 선택된 단계 근거만 반영하세요.
- recommendation은 1~2문장으로 핵심만 간결하게 작성하세요.
- alternative_ideas는 각 항목을 10자 이내의 짧은 키워드/제목으로 작성하세요.
- has_blocking_issues=true이면 verdict는 PIVOT 또는 KILL을 우선 고려하세요.
- has_blocking_issues=true일 때 alternative_ideas에는 공식 API가 있는 대안을 포함하세요.
- [HIGH SEVERITY 병목 규칙]: '기술 실현성'의 high severity 병목이 1개 이상이고 그 병목이 아이디어의 핵심 기능에 직결된다면, GO 판정을 내리지 마세요. 핵심 기능이 구현 가능한지 먼저 검증해야 하므로 PIVOT을 우선 고려하세요. high severity 병목이 2개 이상이면 confidence를 60 이하로 제한하세요.
- [scores.timing 기준]: 아래 기준으로 산정하세요. (1) GitHub 유사 저장소 0개 + 웹 경쟁자 5개 미만 → 80~100 (선점 기회). (2) 기술 스택이 최근 2년 내 등장한 AI/LLM 영역 → +10. (3) 이미 레드오션이거나 시장이 포화 상태 → 20~40. (4) 그 외 → 50 기본값.`;
}

export function buildDataVerificationPrompt(
  sources: { name: string; urls: string[]; snippets: string[] }[]
): string {
  const sourceText = sources
    .map((s, i) => {
      const snippets = s.snippets.slice(0, 3).map(sched => `- ${sched}`).join("\n");
      return `Source ${i + 1}: ${s.name}\nURLs: ${s.urls.join(", ")}\nSnippets:\n${snippets}\n`;
    })
    .join("\n---\n");

  return `당신은 데이터 엔지니어입니다. 웹 검색 결과를 바탕으로 외부 데이터 소스의 기술적 가용성을 검증하세요.

${sourceText}

각 소스에 대해 다음 기준을 엄격히 적용하여 판정하세요:
1. has_official_api: "API Documentation", "Developer Portal", "REST API" 등이 명시적으로 존재하면 true.
2. crawlable: 공식 API는 없지만, 공개된 웹 페이지에서 데이터를 수집할 수 있으면 true. (단, "Scraping Prohibited", "Robot detection" 언급이 있거나, 로그인/캡차가 필수인 경우 false)
3. blocking: API도 없고, 크롤링도 불가능하거나 법적/기술적 제약이 심각하면 true.

반드시 순수 JSON으로만 응답하세요:
{
  "results": [
    {
      "name": "Source Name",
      "has_official_api": boolean,
      "crawlable": boolean,
      "blocking": boolean,
      "reason": "한 줄 판정 이유 (API 문서 URL 또는 제한 사유 포함)"
    }
  ]
}`;
}
