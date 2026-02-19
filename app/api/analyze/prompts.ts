// Prompt builder functions — ported from backend/analyzer.py
// All prompts are in Korean, requiring pure JSON output from Claude.

import type {
  WebSearchResult,
  GitHubSearchResult,
  FeasibilityResult,
  DifferentiationResult,
  DataAvailabilityResult,
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
  "github_query": "GitHub 검색에 최적화된 영어 키워드 (공백 구분)"
}

규칙:
- web_queries: 정확히 2개의 영어 검색 쿼리. 첫 번째는 일반 검색, 두 번째는 경쟁 제품 검색
- github_query: GitHub 저장소 검색에 적합한 영어 키워드 (2~4단어)
- 핵심 기술과 도메인을 반영할 것`;
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

${itemsText}

반드시 순수 JSON으로만 응답하세요:
{"relevant_indices": [0, 2, 5]}`;
}

export function buildDataExtractionPrompt(idea: string): string {
  return `아이디어에서 구현에 필요한 외부 데이터 소스와 npm 라이브러리를 추출하세요.

아이디어: ${idea}

규칙:
- data_sources: 외부 서비스/플랫폼 데이터 (최대 3개, 영어)
  예) "Coupang product reviews", "Naver blog posts", "YouTube video metadata"
- libraries: 핵심 npm 패키지 카테고리 (최대 3개, 영어)
  예) "sentiment analysis", "PDF parsing", "image recognition"
- React/Next.js/TypeScript 같은 범용 의존성 제외
- 아이디어에 명확히 필요한 것만 포함

반드시 순수 JSON으로만 응답:
{"data_sources": ["string"], "libraries": ["string"]}`;
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

1. "이미 있는데?" (Redundancy): 아래 경쟁 제품/GitHub 프로젝트를 바탕으로 기존 서비스와 겹치는 지점을 지적하세요. "그냥 기존 도구 쓰면 되는 거 아냐?"라는 질문에 답해 보세요.
2. "이게 되겠어?" (Feasibility): 제한된 시간 내에 API 레이턴시, 데이터 수집의 한계, UI 복잡도를 고려할 때 발생할 기술적 병목 현상을 꼬집으세요.
3. "누가 써?" (Market Fit): "이건 개발자 자기만족 아냐?" 혹은 "사용자가 굳이 이걸 쓸 이유가 없어"라는 관점에서 사용성 문제를 지적하세요.

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
- total_count 같은 전체 모수는 과장될 수 있으므로 보조 지표로만 사용하세요.

반드시 순수 JSON으로만 응답하세요:

{
  "competition_level": "blue_ocean" | "moderate" | "red_ocean",
  "competition_score": 0-100,
  "existing_solutions": [
    {"name": "제품/프로젝트명", "similarity": 0-100, "weakness": "약점"}
  ],
  "unique_angles": ["차별화 포인트 1", "차별화 포인트 2"],
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

  const feasibilitySection = feasibility
    ? `기술 실현성:
- 점수: ${feasibility.score ?? 50}/100
- 판정: ${feasibility.overall_feasibility || "unknown"}
- 핵심 리스크: ${JSON.stringify(feasibility.key_risks || [])}`
    : "기술 실현성: (미선택)";

  const differentiationSection = differentiation
    ? `차별화:
- 경쟁 수준: ${differentiation.competition_level || "unknown"}
- 경쟁 점수: ${differentiation.competition_score ?? 50}/100
- 차별화 포인트: ${JSON.stringify(differentiation.unique_angles || [])}`
    : "차별화: (미선택)";

  const dataSummary = dataAvailability
    ? `\n데이터/API 가용성:\n- has_blocking_issues: ${String(dataAvailability.has_blocking_issues)}\n- data_sources: ${JSON.stringify(dataAvailability.data_sources)}\n- libraries: ${JSON.stringify(dataAvailability.libraries)}`
    : "";

  return `당신은 단기 개발 아이디어 심판관입니다. 혼자 만드는 개발자 관점에서 선택된 분석 결과만 종합하여 최종 판정을 내리세요.

아이디어: ${idea}
선택된 단계: ${enabledSteps.join(", ")}

${competitionMetrics}
${feasibilitySection}
${differentiationSection}
${dataSummary}

반드시 순수 JSON으로만 응답하세요:

{
  "verdict": "GO" | "PIVOT" | "KILL",
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

주의:
- 제공되지 않은(미선택) 단계 정보는 절대 추정하지 말고 평가에서 제외하세요.
- overall_score는 선택된 단계 근거만 반영하세요.
- recommendation은 1~2문장으로 핵심만 간결하게 작성하세요.
- alternative_ideas는 각 항목을 10자 이내의 짧은 키워드/제목으로 작성하세요.
- has_blocking_issues=true이면 verdict는 PIVOT 또는 KILL을 우선 고려하세요.
- has_blocking_issues=true일 때 alternative_ideas에는 공식 API가 있는 대안을 포함하세요.`;
}
