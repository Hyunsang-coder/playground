# Valid8 — 완전 재구현 스펙 문서

> 이 문서는 Valid8를 처음부터(from scratch) 재구현할 수 있을 만큼 상세하게 작성된 기술 명세서입니다.

---

## 1. 프로젝트 개요

**Valid8**는 해커톤 아이디어를 냉정하게 검증하는 AI 웹 서비스입니다.

- **목적**: 기존 비즈니스/스타트업 관점의 아이디어 검증기와 달리, **해커톤/개발자 관점**에서 기술 실현성 + 경쟁 코드 분석에 집중
- **핵심 차별화**: 바이브코딩(AI 코딩 어시스턴트 활용) 환경에서 1인 개발자가 단기간에 구현 가능한지를 평가
- **결과물**: GO / PIVOT / KILL / FORK 4가지 판정 중 하나

### 분석 파이프라인 요약

```
아이디어 입력
  → [Pre-step] AI 검색 쿼리 생성 (Claude Haiku)
  → [Step 1] 시장 조사: 웹 경쟁 제품 검색(Tavily) + GitHub 유사 프로젝트 검색(GitHub API) — 병렬
              + AI 차별화 분석 (Claude Sonnet 스트리밍)
  → [Step 2] 데이터/API 가용성 검증 (Tavily 증거 검색 + npm 레지스트리 + robots.txt)
              + AI 기술 실현성 분석 (Claude Sonnet 스트리밍)
  → [Step 3] 최종 종합 판정 (Claude Sonnet 스트리밍 → GO/PIVOT/KILL/FORK)
  → 분석 완료 후 AI 팔로업 채팅 (ChatPanel)
```

---

## 2. 기술 스택

| 레이어 | 기술 | 버전 | 용도 |
|--------|------|------|------|
| Framework | Next.js | 16.x (App Router) | 풀스택 앱 |
| UI | React | 19.x | 컴포넌트 |
| 언어 | TypeScript | 5.x (strict) | 전체 |
| 스타일링 | Tailwind CSS | 4.x | 유틸리티 CSS |
| AI SDK | Vercel AI SDK (`ai`) | 6.x | 스트리밍, 채팅 |
| AI 모델 어댑터 | `@ai-sdk/anthropic` | 3.x | Anthropic API 연결 |
| AI 채팅 훅 | `@ai-sdk/react` | 3.x | `useChat` 훅 |
| 마크다운 렌더링 | `react-markdown` | 10.x | ChatPanel 응답 렌더링 |
| 아이콘 | `lucide-react` | 최신 | UI 아이콘 |
| HTTP | 네이티브 `fetch` | — | API 호출 전체 |
| 테스트 (단위) | Vitest | 3.x | 유닛/API 테스트 |
| 테스트 (E2E) | Playwright | 1.x | E2E 테스트 |

### AI 모델 분류

| 모델 | 용도 |
|------|------|
| `claude-sonnet-4-6` | 스트리밍 분석(Step 1~3), 데이터 판정, 관련성 필터링 |
| `claude-haiku-4-5-20251001` | 검색 쿼리 생성, 검색 쿼리 개선 (경량 작업) |

### 외부 API

| 서비스 | 용도 | 비고 |
|--------|------|------|
| Anthropic API | AI 분석 전반 | 필수 |
| Tavily API | 웹 검색 (경쟁 제품, 데이터 가용성 증거) | 필수 |
| GitHub Search API v3 | 유사 오픈소스 프로젝트 검색 | 선택 (`GITHUB_TOKEN`으로 속도 제한 완화) |
| npm 레지스트리 | 라이브러리 가용성 검증 | API 키 불필요 |

---

## 3. 환경 변수

`.env.local`에 설정:

```
ANTHROPIC_API_KEY=sk-ant-...   # 필수
TAVILY_API_KEY=tvly-...        # 필수
GITHUB_TOKEN=ghp_...           # 선택 (속도 제한 완화)
```

모든 변수는 서버 사이드 전용 (NEXT_PUBLIC_ 접두사 불필요).

---

## 4. 프로젝트 구조

```
├── package.json
├── next.config.ts              # Next.js 설정 (rewrite 없음)
├── tsconfig.json               # TypeScript strict 모드
├── postcss.config.mjs          # PostCSS + Tailwind
├── eslint.config.mjs
├── playwright.config.ts        # E2E 설정 (baseURL: localhost:3000)
├── .env.local                  # 커밋하지 않음
├── tests/
│   ├── unit/                   # Vitest 단위 테스트
│   ├── api/                    # Vitest API 테스트
│   └── e2e/                    # Playwright E2E 테스트
└── app/
    ├── layout.tsx              # 루트 레이아웃 (lang="ko", favicon=shield.svg)
    ├── page.tsx                # 메인 페이지 (입력뷰 ↔ 결과뷰 라우팅)
    ├── globals.css             # Tailwind + 테마 변수 + 커스텀 애니메이션
    ├── types.ts                # 모든 TypeScript 인터페이스
    ├── useAnalysis.ts          # SSE 스트림 파싱 커스텀 훅
    ├── components/
    │   ├── Header.tsx
    │   ├── IdeaInput.tsx
    │   ├── StepCard.tsx
    │   ├── CompetitorList.tsx
    │   ├── GitHubList.tsx
    │   ├── FeasibilityCard.tsx
    │   ├── DifferentiationCard.tsx
    │   ├── VerdictCard.tsx
    │   └── ChatPanel.tsx
    └── api/
        ├── chat/route.ts
        └── analyze/
            ├── route.ts        # SSE 스트리밍 엔드포인트
            ├── analyzer.ts     # IdeaAnalyzer 클래스 (3단계 파이프라인)
            ├── prompts.ts      # 8개 프롬프트 빌더 함수
            ├── rules.ts        # npm 패키지 후보 선택 로직
            └── utils.ts        # parseJsonSafe, 폴백, 캐시, 타입
```

---

## 5. TypeScript 타입 정의 (`app/types.ts`) — 완전한 실제 코드

```typescript
export interface Competitor { title: string; url: string; snippet: string }
export interface GitHubRepo {
  name: string; description: string; stars: number;
  url: string; language: string; updated: string;
}
export interface WebSearchResult { competitors: Competitor[]; raw_count: number; summary: string }
export interface GitHubSearchResult { repos: GitHubRepo[]; total_count: number; summary: string }
export interface TechRequirement {
  name: string; available: boolean; difficulty: "easy"|"medium"|"hard"; note: string;
}

export type BottleneckType =
  | "api_unavailable" | "auth_complexity" | "data_structure_unknown"
  | "realtime_required" | "no_library" | "complex_algorithm"
  | "binary_processing" | "existing_open_source";   // ← "existing_open_source" 포함

export interface Bottleneck {
  type: BottleneckType; description: string; severity: "high"|"medium"; suggestion: string;
}

export interface DataSource {
  name: string; has_official_api: boolean; crawlable: boolean;
  evidence_url?: string; blocking: boolean; note: string;
}
export interface LibraryCheck {
  name: string; available_on_npm: boolean; package_name?: string; note: string;
}
export interface DataAvailabilityResult {
  data_sources: DataSource[]; libraries: LibraryCheck[]; has_blocking_issues: boolean;
}

export interface FeasibilityResult {
  overall_feasibility: "possible"|"partial"|"difficult";
  score: number;
  vibe_coding_difficulty?: "easy"|"medium"|"hard";
  bottlenecks: string[] | Bottleneck[];   // ← string[] 혼합 허용
  data_availability?: DataAvailabilityResult;
  tech_requirements: TechRequirement[];
  key_risks: string[];
  time_estimate: string;
  summary: string;
}

export interface ExistingSolution { name: string; similarity: number; weakness: string }
export interface DifferentiationResult {
  competition_level: "blue_ocean"|"moderate"|"red_ocean";
  competition_score: number;
  existing_solutions: ExistingSolution[];
  unique_angles: string[];
  is_exact_match_found: boolean;
  exact_match_repo?: GitHubRepo;   // ← FORK 시 참조용 옵셔널 필드
  summary: string;
}

// Step 1 step_result의 최상위 shape — 이 타입이 result로 전달됨
export interface MarketAndDifferentiationResult {
  web: WebSearchResult;       // competitors + raw_count + summary
  github: GitHubSearchResult; // repos + total_count + summary
  differentiation: DifferentiationResult;
}

export interface VerdictScores {
  competition: number; feasibility: number; differentiation: number; timing: number;
}
export interface VerdictResult {
  verdict: "GO"|"PIVOT"|"KILL"|"FORK";
  overall_score: number;
  scores: VerdictScores;
  one_liner: string;
  recommendation: string;
  alternative_ideas: string[];
  // confidence 필드: 타입에 없음 (UI에서 미사용)
}

export type StepStatus = "pending"|"loading"|"done";
export interface AnalysisStep {
  step: number; title: string; description: string;
  status: StepStatus;
  result?: unknown;       // 각 step별로 실제 타입이 다름 (위 참조)
  progressText?: string;
}
```

**specs §5 하단의 이전 타입 정의는 이 섹션으로 대체됨.**

---

## 5-B. `useAnalysis.ts` — 완전한 실제 코드

```typescript
"use client";
import { useState, useCallback } from "react";
import type { AnalysisStep } from "./types";

export function useAnalysis() {
  const [steps, setSteps] = useState<AnalysisStep[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (idea: string, enabledSteps: number[] = [1, 2, 3]) => {
    setSteps([]);
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, enabledSteps }),
      });

      if (!response.ok) {
        let message = `Server error: ${response.status}`;
        try {
          const payload = await response.json() as { error?: string };
          if (payload.error) message = payload.error;
        } catch { /* ignore */ }
        throw new Error(message);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true }); // stream:true — 멀티바이트 문자 분할 대응
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // 마지막 불완전한 줄은 버퍼에 유지

          for (const line of lines) {
            if (line.startsWith("event:")) continue; // SSE event: 행 무시
            if (!line.startsWith("data:")) continue;

            const dataStr = line.slice(5).trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);

              if (data.step !== undefined && data.title) {
                // step_start: step + title 있음
                setSteps(prev => [...prev, {
                  step: data.step, title: data.title,
                  description: data.description || "", status: "loading",
                }]);
              } else if (data.step !== undefined && data.text && !data.result) {
                // step_progress: step + text, result 없음
                setSteps(prev => prev.map(s =>
                  s.step === data.step ? { ...s, progressText: data.text } : s
                ));
              } else if (data.step !== undefined && data.result) {
                // step_result: step + result 있음
                setSteps(prev => prev.map(s =>
                  s.step === data.step
                    ? { ...s, status: "done" as const, result: data.result, progressText: undefined }
                    : s
                ));
              } else if (data.message === "분석 완료") {
                setIsAnalyzing(false);
              }
            } catch { /* malformed JSON 무시 */ }
          }
        }
      } catch (err) {
        reader.cancel().catch(() => undefined);
        throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setSteps([]); setIsAnalyzing(false); setError(null);
  }, []);

  return { steps, isAnalyzing, error, analyze, reset };
}
```

**핵심 파싱 포인트**:
- `TextDecoder({ stream: true })` — 청크 경계에서 멀티바이트 문자가 잘릴 때 대응
- `lines.pop()` — 마지막 불완전한 줄은 다음 청크를 위해 버퍼에 보존
- `event:` 행은 skip (SSE 표준이지만 서버가 보내더라도 무시)
- 이벤트 타입 구분: `title` 유무 → step_start, `text && !result` → progress, `result` → result
- `done` 이벤트: `setIsAnalyzing(false)` 호출 + `finally`에서도 한번 더 (중복 안전)
- 오류 시 `reader.cancel()` 후 rethrow → `catch`에서 `setError`

---

## 5-C. 구 타입 정의 (§5로 대체됨 — 무시)

```typescript
// 웹 검색
interface Competitor { title: string; url: string; snippet: string }
interface WebSearchResult { competitors: Competitor[]; raw_count: number; summary: string }

// GitHub 검색
interface GitHubRepo {
  name: string; description: string; stars: number;
  url: string; language: string; updated: string
}
interface GitHubSearchResult { repos: GitHubRepo[]; total_count: number; summary: string }

// 실현성 분석
interface Bottleneck {
  type: "api_unavailable"|"auth_complexity"|"data_structure_unknown"|"realtime_required"|
        "no_library"|"complex_algorithm"|"binary_processing";
  description: string;
  severity: "high" | "medium";
  suggestion: string;
}
interface TechRequirement { name: string; available: boolean; difficulty: "easy"|"medium"|"hard"; note: string }
interface FeasibilityResult {
  overall_feasibility: "possible" | "partial" | "difficult";
  score: number;  // 0-100
  vibe_coding_difficulty: "easy" | "medium" | "hard";
  bottlenecks: Bottleneck[];
  tech_requirements: TechRequirement[];
  key_risks: string[];
  time_estimate: string;
  summary: string;
  data_availability?: DataAvailabilityResult;
}

// 차별화 분석
interface ExistingSolution { name: string; similarity: number; weakness: string }
interface DifferentiationResult {
  competition_level: "blue_ocean" | "moderate" | "red_ocean";
  competition_score: number;  // 70-100=blue_ocean, 40-69=moderate, 0-39=red_ocean
  existing_solutions: ExistingSolution[];
  unique_angles: string[];
  is_exact_match_found: boolean;
  summary: string;
}

// 데이터 가용성
interface DataSource {
  name: string; has_official_api: boolean; crawlable: boolean;
  blocking: boolean; evidence_url?: string; note: string;
}
interface LibraryCheck { name: string; available_on_npm: boolean; package_name?: string; note: string }
interface DataAvailabilityResult {
  data_sources: DataSource[];
  libraries: LibraryCheck[];
  has_blocking_issues: boolean;
}

// 최종 판정
interface VerdictScores { competition: number; feasibility: number; differentiation: number; timing: number }
interface VerdictResult {
  verdict: "GO" | "PIVOT" | "KILL" | "FORK";
  confidence: number;
  overall_score: number;
  scores: VerdictScores;
  one_liner: string;
  recommendation: string;
  alternative_ideas: string[];
}

// UI 상태
interface AnalysisStep {
  step: number;
  title: string;
  description: string;
  status: "pending" | "loading" | "done";
  result?: Record<string, unknown>;
  progressText?: string;
}
```

---

## 6. API 설계

### POST `/api/analyze` — SSE 스트리밍 분석

**요청**:
```json
{ "idea": "string (max 500자)", "enabledSteps": [1, 2, 3] }
```

`enabledSteps`는 항상 `[1, 2, 3]`로 UI에서 하드코딩. API는 수용만 함.

**응답**: SSE 스트림 (`data: {json}\n\n`)

| 이벤트 | 데이터 구조 |
|--------|------------|
| `step_start` | `{ step: 1-3, title: string, description: string }` |
| `step_progress` | `{ step: 1-3, text: string }` |
| `step_result` | `{ step: 1-3, result: {...} }` |
| `done` | `{ message: "분석 완료" }` |

**step_result 데이터 구조별 차이**:
- Step 1: `{ web: WebSearchResult & { github_repos }, github: GitHubSearchResult, differentiation: DifferentiationResult }`
- Step 2: `FeasibilityResult` (data_availability 포함)
- Step 3: `VerdictResult`

**유효성 검사**:
- `idea`: 필수, 최대 500자
- `enabledSteps`: 1, 2, 3 중 하나 이상 포함 필요

### POST `/api/chat` — AI 팔로업 채팅

**요청**:
```json
{ "messages": [...], "analysisResults": [...], "idea": "string" }
```

**제한**:
- 최대 40개 메시지
- messages JSON: 최대 60KB
- analysisResults JSON: 최대 12KB (title 120자로 잘라 정제 후 전송)

**응답**: Vercel AI SDK `toUIMessageStreamResponse()` 스트림

---

## 7. 백엔드 아키텍처 — `IdeaAnalyzer` 클래스

### 생성자
```typescript
constructor(anthropicApiKey: string, tavilyApiKey: string, githubToken: string = "")
```

### 캐싱 전략

두 종류의 캐시가 독립적으로 운용됩니다.

| 캐시 | 저장 위치 | TTL | 최대 항목 | 대상 |
|------|---------|-----|---------|------|
| 검색 캐시 | `utils.ts` 전역 `Map` (모듈 수준) | 10분 | 100 | 웹/GitHub 검색 결과 |
| 데이터 가용성 캐시 | `IdeaAnalyzer` 인스턴스 내 `Map` | 30분 | 100 | `checkDataAndLibraries` 결과 |

**캐시키 생성 방식**:
```typescript
// 웹 검색: 쿼리 2개를 알파벳순 정렬 후 | 로 연결
buildCacheKey("web", query1, query2)
// → "web:${normalize(sort([q1,q2]).join('|'))}"

// GitHub 검색: primaryQuery + secondaryQuery
buildCacheKey("github", primaryQuery, secondaryQuery)

// 데이터 가용성: 아이디어 전체
buildCacheKey("data-availability", idea)
```

**캐시 만료 처리**:
- `cacheGet`: 항목 조회 시 TTL 초과면 즉시 삭제하고 `null` 반환
- `cacheSet`: 용량 초과 시 → 먼저 만료 항목 일괄 삭제 → 여전히 초과면 가장 오래된 항목 1개 삭제(LRU)

### `analyze()` — 메인 제너레이터

```typescript
async *analyze(idea: string, enabledSteps: number[]): AsyncGenerator<SSEEvent>
```

실행 순서와 데이터 흐름:

```
1. Pre-step: generateSearchQueries(idea)
   [Claude Haiku, maxOutputTokens=256]
   → { web_queries: [q1, q2], github_queries: [gq1, gq2] }
   → 실패 시 fallback: ["${idea} tool service app", "${idea} alternative competitor"]

2. Step 1 (Promise.all 병렬):
   ├── searchWeb(idea, web_queries)
   │   └── 4단계 파이프라인 (상세 하단 참조)
   └── searchGithub(idea, github_queries)
       └── 3단계 조건 완화 전략 (상세 하단 참조)
   → 두 결과 준비 완료 후 streamDifferentiation() 시작
   → SSE: step_result = { web: {..+github_repos}, github: {...}, differentiation: {...} }

3. Step 2 (순차):
   checkDataAndLibraries(idea)
   → 5단계 파이프라인 (상세 하단 참조)
   → streamFeasibility(idea, dataAvailability)
   → SSE: step_result = FeasibilityResult (data_availability 포함)

4. Step 3:
   streamVerdict(idea, { enabledSteps, competitors?, githubResults?, feasibility?, differentiation?, dataAvailability? })
   → SSE: step_result = VerdictResult

5. SSE: done = { message: "분석 완료" }
```

---

## 7-A. 웹 검색 알고리즘 상세 (`searchWeb` + `doWebSearchParallel` + `refineSearchQueries` + `filterRelevant` + `rerankCompetitors`)

### Phase 1 — Tavily 병렬 호출 (`doWebSearchParallel`)

```typescript
// 두 쿼리를 완전히 독립적인 fetch로 병렬 실행
const [resp1, resp2] = await Promise.all([
  fetch("https://api.tavily.com/search", {
    body: JSON.stringify({
      api_key: tavilyApiKey,
      query: query1,
      max_results: 8,        // 첫 번째 쿼리: 넓게
      search_depth: "basic", // 또는 "advanced" (Phase 2 재시도 없음)
      include_raw_content: true,  // snippet 500자 확보 위해 필수
    }),
    signal: AbortSignal.timeout(depth === "advanced" ? 25000 : 15000),
  }),
  fetch("https://api.tavily.com/search", {
    body: JSON.stringify({
      query: query2,
      max_results: 5,        // 두 번째 쿼리: 좁게
      search_depth: "basic",
      include_raw_content: true,
    }),
    signal: AbortSignal.timeout(15000), // 독립 타임아웃
  }),
]);
```

결과 병합 규칙:
- URL 기반 중복 제거 (`Set<string>`)
- 두 응답 순서대로 합치기 (resp1 먼저, resp2 나중)
- `resp.ok` 실패 시 해당 응답만 건너뜀 (전체 실패 아님)
- `snippet = raw_content.slice(0, 500)` (raw_content 없으면 content 사용)

### Phase 2 — 희소 결과 개선 (`refineSearchQueries`)

결과 수가 3개 미만일 때만 실행:
```typescript
if (competitors.length < 3) {
  // Claude Haiku에게 "이전 결과가 부실하다"는 컨텍스트와 함께 새 쿼리 요청
  // 규칙: 이전 쿼리와 다른 각도, 더 넓은 키워드, 동의어/유사 도메인 활용
  const refinedQueries = await refineSearchQueries(idea, competitors);
  // 개선 쿼리로 doWebSearchParallel 재실행
  const retryResults = await doWebSearchParallel(rq1, rq2, "basic");
  // URL 중복 제거하며 기존 결과에 추가 (기존 결과 우선)
}
```

### Phase 3 — AI 관련성 필터링 (`filterRelevant`)

Claude Sonnet에게 경쟁 제품만 고르게 요청:
```
제거 대상: 뉴스 기사, 블로그 포스트, 튜토리얼, 문서
유지 대상: 실제 경쟁 제품/서비스/도구
출력: {"relevant_indices": [0, 2, 5]}  ← 관련도 높은 순서로 인덱스 정렬
```

구현 세부사항:
- `maxOutputTokens: 128` (인덱스 배열만 출력이므로 짧음)
- `parseJsonSafe`로 파싱 실패 시 → 원래 전체 목록 반환 (필터 미적용)
- 유효한 인덱스만 수용 (범위 초과 인덱스 무시)

### Phase 4 — 결정론적 리랭킹 (`rerankCompetitors`)

점수 계산 알고리즘 (title + snippet 텍스트 기반):

```
점수 = Σ(아이디어 토큰 매칭) + Σ(긍정 패턴) + Σ(신뢰 도메인) - Σ(노이즈 패턴) - Σ(노이즈 도메인)

아이디어 토큰 매칭:
  - idea를 소문자 + 정규화 후 토큰 분리 (3자 이상만, 최대 8개)
  - 각 토큰이 title+snippet에 포함되면 +3

긍정 패턴 (각 +1):
  app, tool, software, platform, product, service, saas,
  pricing, alternative, competitor

노이즈 패턴 (각 -2):
  blog, tutorial, guide, how to, news, press release,
  reddit, quora, youtube, linkedin, tistory, velog

신뢰 도메인 (각 +3):
  github.com, producthunt.com, g2.com, capterra.com, crunchbase.com

노이즈 도메인 (각 -2):
  medium.com, dev.to, blog., news., youtube.com
```

정렬 기준: `(b.score - a.score) || (a.index - b.index)` — 동점 시 원래 순서 유지 (UI 깜빡임 방지)

최종 반환: 상위 10개

---

## 7-B. GitHub 검색 알고리즘 상세 (`searchGithub`)

### 3단계 조건 완화 전략

단계별로 누적 결과가 5개 이상이면 조기 종료:

```typescript
const searchPlans = [
  // 1차: 엄격한 조건 — 최신(2년), 별 50+ 이상
  { query: primaryQuery, minStars: 50, withDateFilter: true },
  // 2차: 날짜 조건 제거 — 오래된 프로젝트도 포함, 별 10+
  { query: primaryQuery, minStars: 10, withDateFilter: false },
  // 3차: 보조 쿼리 (더 넓은 카테고리) — 관대한 조건
  { query: secondaryQuery, minStars: 10, withDateFilter: false },
];
```

**각 plan별 GitHub API 쿼리 구성**:
```
q=${plan.query} stars:>=${minStars} pushed:>=${2년전} archived:false
  &sort=stars&order=desc&per_page=10
```

- `withDateFilter=false`이면 `pushed:` 조건 제외
- `archived:false`: 보관된 레포지토리 제외
- URL: `https://api.github.com/search/repositories`
- 헤더: `Accept: application/vnd.github.v3+json`, 토큰 있으면 `Authorization: token {}`
- `AbortSignal.timeout(15000)` 각 plan 독립 적용
- 422 (쿼리 오류), 403 (속도 제한) 응답 → `continue`로 다음 plan 진행 (console.warn 로그)

**중복 제거**: `html_url` 기반 `Set<string>`으로 plan 간 중복 제거

**최종 정렬**: 별점 내림차순, 최대 10개

---

## 7-C. 데이터 가용성 파이프라인 상세 (`checkDataAndLibraries`)

5단계 직렬/병렬 혼합 파이프라인:

### Stage 1 — 데이터 소스/라이브러리 추출 (Claude Sonnet, maxOutputTokens=512)

```
입력 프롬프트 규칙:
- data_sources: 외부 서비스/플랫폼 데이터 최대 3개 (범용 의존성 제외)
  각 소스마다 search_queries 3개 제공:
  [0] 공식 API 문서 검색 (영어): "coupang open API developer documentation"
  [1] 개발자 포털/가격 검색 (영어): "coupang developer portal pricing free tier"
  [2] 한국어 가이드 검색: "쿠팡 오픈API 개발자 가이드"
- libraries: 실제 npm 패키지명으로 최대 3개 (범용 제외)
  - 정확한 패키지명 모르면 "category:설명" 형식 허용
```

파싱 후 처리:
- 레거시 문자열 형식과 신형 `{name, search_queries}` 형식 모두 수용
- 소스명 중복 제거 (`Set`)
- 쿼리 개수: 소스당 custom queries 2개 사용, 없으면 자동 생성 (`{name} official API documentation`, `{name} developer portal`)
- 쿼리 중복 제거 후 최대 6개 선택

### Stage 2 — Tavily 증거 검색 (`doDataAvailabilitySearch`, 병렬)

```typescript
// 최대 6개 쿼리를 Promise.all로 병렬 실행
const results = await Promise.all(
  queries.slice(0, 6).map(async (query) => {
    const resp = await fetch("https://api.tavily.com/search", {
      body: JSON.stringify({
        query,
        max_results: 3,
        search_depth: "basic",
        // include_raw_content: 없음 (snippet만 필요)
      }),
      signal: AbortSignal.timeout(15000),
    });
    return [query, { urls: top3.urls, snippets: top3.content.slice(0, 300) }];
  })
);
// 결과: Map<query, { urls: string[], snippets: string[] }>
```

### Stage 3 — AI 판정 + npm 검증 (병렬)

```typescript
const [claudeJudgment, libraryResults] = await Promise.all([
  getClaudeDataJudgment(dataSources, libraries, evidenceMap),
  Promise.all(libraries.map(validateLibraryOnNpm)),
]);
```

**`getClaudeDataJudgment` 세부사항**:
- 모델: Claude Sonnet, maxOutputTokens=1024
- evidence 입력 최적화: URLs 상위 2개, snippets 상위 3개만 전달 (토큰 절약)
- 판정 기준 (프롬프트 내 명시):
  - `has_official_api=true`: "free tier", "get API key", "open API" 등 확인
  - `crawlable=true`: 공개 웹사이트 존재 + 수집 가능 신호
  - `blocking=true`: "closed beta", "contact us", "requires partnership"
  - `evidence_url`: 가장 신뢰 가능한 URL 1개

### Stage 4 — URL 검증 + robots.txt 확인 (소스별 순차)

각 데이터 소스에 대해:

```
[4a] verifyApiUrl(evidence_url) — HEAD 요청, timeout 5s
  - alive=true && has_official_api=true → note에 "(URL 검증 완료)" 추가
  - alive=false && has_official_api=true → has_official_api=false로 강등
                                          blocking = !crawlable
                                          note에 "(근거 URL 접근 불가 — 수동 확인 필요)"

[4b] crawlable=true이면 → checkRobotsPolicy([evidence_url]) — timeout 6s
  - 최대 2개 도메인에 대해 https://{domain}/robots.txt 요청
  - isRobotsDisallowAll() 파싱:
      * User-agent: * 섹션 식별
      * Disallow: / 있고 Allow: / 없으면 → disallowAll=true
      * 주석(# ...) 제거 후 파싱
  - disallowAll=true → blocking=true, note에 "(robots.txt 전면 차단 발견)" 추가
```

**robots.txt 파싱 로직 (`isRobotsDisallowAll`) 정확한 구현**:
```
조건: sawStarGroup=true AND hasDisallowAll=true AND hasAllowRoot=false
- sawStarGroup: User-agent: * 를 만났을 때 true
- hasDisallowAll: Disallow: / 를 만났을 때 true
- hasAllowRoot: Allow: / 또는 Allow: "" 또는 Disallow: "" 를 만났을 때 true
→ hasAllowRoot가 true면 허용 (차단 아님)
```

### Stage 5 — 최종 결합

```typescript
const hasBlockingIssues = dataSourceResult.some(s => s.blocking);
return { data_sources: dataSourceResult, libraries: libraryResults, has_blocking_issues: hasBlockingIssues };
```

---

## 7-D. npm 라이브러리 검증 알고리즘 상세 (`validateLibraryOnNpm`)

### 입력 정규화

```typescript
// "npm:cheerio" → "cheerio"
const trimmed = raw.trim().replace(/^npm[:\s]+/i, "");

// "category:PDF 파서" → { query: "PDF 파서", isCategoryHint: true }
const categoryMatch = trimmed.match(/^category\s*:\s*(.+)$/i);
```

### 검증 흐름 (3단계)

```
Step 1: 유효한 패키지명 형식인지 확인
  정규식: /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i
  → 유효하면 registry.npmjs.org/{encodedName} 직접 조회 (timeout 8s)
  → 200 OK → available_on_npm=true, package_name=query 반환

Step 2: npm 검색 API
  URL: https://registry.npmjs.org/-/v1/search?text={query}&size=6
  → 최대 6개 후보 반환
  → selectNpmCandidate(query, candidates)로 최적 후보 선택

Step 3: 선택된 후보 재확인
  → registry.npmjs.org/{selected} 조회로 실존 여부 최종 확인
  → confident=true이면 available_on_npm=true 반환
  → confident=false이면 available_on_npm=false + "수동 확인 권장" 메모
```

### npm 후보 선택 알고리즘 (`selectNpmCandidate`)

```typescript
// 각 후보의 점수 계산
score =
  (exactMatch ? 5 : 0)          // 정확히 이름 일치
  + (nearNameMatch ? 2 : 0)     // 이름에 쿼리 포함 또는 쿼리에 이름 포함
  + tokenOverlap * 1.5          // 토큰 겹침 수 × 1.5
  + Math.min(candidate.score, 1) // npm 점수 (0~1 범위로 cap)
```

**토큰 겹침 계산**:
- 스톱워드 제거: npm, package, library, javascript, typescript, node, react, sdk, tool, for, and, the 등
- 3자 미만 토큰 제거
- `queryToken === candidateToken` 또는 포함 관계 있으면 겹침으로 인정

**confident 판정 기준**:
```
queryTokens 수 >= 2:  tokenOverlap >= 2 AND candidate.score >= 0.5
queryTokens 수 < 2:   tokenOverlap >= 1 AND candidate.score >= 0.7
또는:                 exactMatch=true이면 무조건 confident
```

---

## 7-E. 데이터 소스 규칙 기반 평가 (`evaluateDataSourceWithRules`)

Tavily 검색 결과를 규칙 기반으로 1차 평가하는 함수 (현재 AI 판정 이전 단계에서 참고용):

### API 존재 긍정 패턴 (RegExp, `/i` 플래그)
```
/\bapi documentation\b/, /\bapi docs?\b/, /\bapi reference\b/,
/\bdeveloper portal\b/, /\bopen api\b/, /\bopenapi\b/,
/\bget api key\b/, /\bpublic api\b/, /\brest api\b/,
/\bgraphql api\b/, /\bswagger\b/
```

### API 부재 부정 패턴
```
/\bno api\b/, /\bwithout api\b/, /\bapi is not available\b/,
/\bprivate api\b/, /\bpartner api\b/, /\brequires? partnership\b/,
/\bclosed beta\b/, /\binvite[- ]only\b/, /\bcontact sales\b/,
/\bcontact us\b/, /\benterprise only\b/,
/공식\s*api\s*없/i, /api\s*미지원/i, /파트너\s*전용/i
```

### 법적 차단 패턴 (크롤링 금지)
```
영어: /\bno scraping\b/, /\bscraping (is )?prohibited\b/,
      /\bdo not scrape\b/, /\bautomated access (is )?prohibited\b/,
      /\bunauthorized scraping\b/, /\brobots\.txt disallow\b/
한국어: /크롤링\s*금지/i, /스크래핑\s*금지/i,
        /자동화된\s*수집\s*금지/i, /무단\s*수집\s*금지/i
```

### 판정 로직
```typescript
const hasOfficialApi = apiPositiveHits >= 2 && apiNegativeHits === 0;
// 긍정 패턴 2개 이상 + 부정 패턴 0개일 때만 공식 API 있음

const crawlable = !hasOfficialApi && crawlSignals && !crawlBlockedByPolicy;
// 공식 API 없고, 크롤 가능한 공개 페이지 있고, 정책 차단 없을 때

const blocking = !hasOfficialApi && !crawlable;
// 둘 다 없으면 블로킹
```

**evidence_url 선택**: API URL 힌트(`developer.`, `/api`, `swagger` 등) 포함 URL 우선 선택

---

## 8. 프롬프트 엔지니어링 (`prompts.ts`)

### 핵심 원칙
- **모든 Claude 프롬프트**: 순수 JSON 출력만 요구 (마크다운/코드블록 금지)
- **모든 프롬프트 언어**: 한국어 (사용자 인터페이스도 한국어)
- **parseJsonSafe**: Claude가 코드블록으로 감쌀 경우를 대비한 3단계 파싱

### 8개 프롬프트 함수

| 함수 | 모델 | 역할 |
|------|------|------|
| `buildSearchQueriesPrompt` | Haiku | 웹 쿼리 2개 + GitHub 쿼리 2개 생성 |
| `buildRefineSearchQueriesPrompt` | Haiku | 초기 결과 부실 시 개선 쿼리 생성 |
| `buildFilterRelevantPrompt` | Sonnet | 경쟁 제품만 필터링 (블로그/뉴스 제거) |
| `buildDataExtractionPrompt` | Sonnet | 아이디어에서 데이터 소스 + 라이브러리 추출 |
| `buildDataJudgmentPrompt` | Sonnet | Tavily 증거 기반 API 가용성 판정 |
| `buildFeasibilityPrompt` | Sonnet | 바이브코딩 난이도 + 병목 분석 |
| `buildDifferentiationPrompt` | Sonnet | 냉철한 VC 관점 차별화 분석 |
| `buildVerdictPrompt` | Sonnet | 최종 GO/PIVOT/KILL/FORK 판정 |

### 판정 기준 규칙 (구현 시 반드시 준수)

**feasibility score ↔ overall_feasibility 매핑**:
- 70~100 → `"possible"`
- 40~69 → `"partial"`
- 0~39 → `"difficult"`
- high severity 병목 1개 이상: score ≤ 60
- high severity 병목 2개 이상: score ≤ 50

**competition_score ↔ competition_level 매핑**:
- 70~100 → `"blue_ocean"`
- 40~69 → `"moderate"`
- 0~39 → `"red_ocean"`

**verdict 결정 규칙** (우선순위 순):
1. `is_exact_match_found=true` → **FORK** (또는 KILL)
2. `has_blocking_issues=true` → PIVOT 또는 KILL 우선 고려
3. high severity 병목 핵심 기능 직결 → GO 금지 (PIVOT 우선)
4. 나머지 → overall_score로 종합 판정

**scores.timing 산정 기준**:
- GitHub 유사 저장소 0개 + 웹 경쟁자 5개 미만: 80~100
- 최근 2년 내 AI/LLM 기술 스택: +10
- 레드오션/포화 시장: 20~40
- 기본값: 50

---

## 9. 프론트엔드 아키텍처

### 상태 관리 (`useAnalysis.ts`)

단일 커스텀 훅이 모든 상태 관리:

```typescript
// 반환값
{
  steps: AnalysisStep[];    // 누적된 단계 데이터
  isAnalyzing: boolean;     // 로딩 상태
  error: string | null;     // 오류 메시지
  analyze(idea: string, enabledSteps: number[]): Promise<void>;
  reset(): void;
}
```

**SSE 파싱 로직** (EventSource API 사용 불가 — POST 요청 필요):
```typescript
// 이벤트 타입 감지 기준
data.step + data.title           → step_start
data.step + data.text (결과 없음) → step_progress
data.step + data.result          → step_result
data.message === "분석 완료"     → done
```

### 메인 페이지 (`page.tsx`)

```typescript
// 두 가지 뷰 전환
steps.length === 0 && !isAnalyzing  → IdeaInput 뷰 (전체 화면)
steps.length > 0 || isAnalyzing     → 결과 뷰 (StepCard 목록)
```

기능:
- 진행률 표시: `completedSteps / enabledSteps.length`
- 분석 결과 내보내기: MD 형식 / JSON 형식
- 오류 배너 (빨간색) + 재시도 버튼
- 대안 아이디어 클릭 → 해당 아이디어로 즉시 재분석
- 분석 초기화 (reset)

### 컴포넌트 계층

```
Page (Client Component)
├── Header
│   ├── ShieldCheck 아이콘 + "Valid8" 타이틀 ("8"만 브랜드 색상)
│   └── 테마 선택기 (Palette 아이콘, 5가지 테마)
├── IdeaInput (steps 없고 분석 중 아닐 때만 표시)
│   ├── 텍스트에어리어 (Enter=제출, Shift+Enter=줄바꿈)
│   ├── 예시 칩 4개 (클릭하면 자동 입력 + 제출)
│   └── 제출 버튼: "바이브코딩(AI)으로 당당 구현 가능한가요?"
└── 결과 뷰 (steps 있거나 분석 중일 때)
    ├── 진행률 바 (shimmer 애니메이션)
    ├── StepCard × 3 (로딩 스켈레톤 → 결과 카드)
    │   ├── Step 1: CompetitorList + GitHubList + DifferentiationCard
    │   ├── Step 2: FeasibilityCard (BlockingWarningBanner + DataAvailabilitySection)
    │   └── Step 3: VerdictCard (AnimatedScore + 점수 바 + 대안 아이디어)
    └── ChatPanel (모든 단계 완료 후 표시)
        ├── useChat 훅 (DefaultChatTransport → POST /api/chat)
        ├── 제안 질문 4개
        └── ReactMarkdown으로 메시지 렌더링
```

### VerdictCard 특수 동작
- 렌더링 시 자동 스크롤 (`useEffect` + `scrollIntoView`)
- AnimatedScore: 1.2초 `cubic-bezier(0.16, 1, 0.3, 1)` 이징 애니메이션
- 클립보드 복사 버튼 (전체 결과 요약)

---

## 10. 디자인 시스템

### 색상 시맨틱 (고정)

```css
/* 판정 색상 — 절대 변경 금지 */
--color-go:    #10b981  /* 녹색 */
--color-pivot: #f59e0b  /* 노란색 */
--color-kill:  #f43f5e  /* 빨간색 */
/* FORK는 파란색 (#3b82f6) — Tailwind blue-500 */
```

Tailwind 유틸리티 클래스로 사용: `text-go`, `bg-go/10`, `border-go`

### 테마 시스템

`data-theme` 어트리뷰트로 전환, CSS 변수 `--brand` 재정의:

| 테마 | `--brand` | 설명 |
|------|-----------|------|
| hackathon (기본) | `#f97316` | 오렌지 |
| indigo | `#6366f1` | 인디고 |
| cyber | `#0ea5e9` | 스카이블루 |
| hacker | `#22c55e` | 그린 |
| slate | `#334155` | 슬레이트 |

### 커스텀 애니메이션

```css
animate-fade-in         /* fadeIn 0.5s ease-out */
animate-slide-up        /* slideUp 0.4s ease-out */
animate-verdict-reveal  /* scale 0.3→1.1→1, 0.8s */
animate-score-count     /* translateY(30px)+scale(0.5)→0+1, 1.2s */
animate-verdict-glow    /* box-shadow 맥동, 2s infinite */
shimmer-skeleton        /* shimmer 1.5s (로딩 스켈레톤) */
progress-shimmer        /* shimmer 2s (진행률 바) */
```

### 레이아웃 원칙
- 배경: `#fafaf9` + `var(--bg-gradient)` (테마별 radial gradient)
- 카드: `rounded-2xl border border-slate-200/80 bg-white shadow-sm`
- 숫자 강조: `text-5xl font-black` 또는 `text-6xl font-black`
- 경쟁도/실현성 색상: score 값에 따라 go/pivot/kill 동적 적용
- 스크롤바: 너비 6px, 컬러 `#cbd5e1` (hover: `#94a3b8`)

---

## 11. 폴백 전략 (안정성 최우선)

각 외부 서비스 독립적으로 폴백:

| 실패 시나리오 | 폴백 동작 |
|-------------|---------|
| Tavily API 실패 | 빈 경쟁 제품 목록 + summary에 오류 메시지 |
| GitHub API 실패 | 빈 레포지토리 목록 + summary에 오류 메시지 |
| Claude API 실패 (Step 1) | `fallbackDifferentiation()`: 경쟁자 수로 competition_score 계산 |
| Claude API 실패 (Step 2) | `fallbackFeasibility()`: score=50, "partial" |
| Claude API 실패 (Step 3) | `fallbackVerdict()`: feasibility + differentiation 평균 → ≥70=GO, ≥40=PIVOT, <40=KILL |
| API 키 누락 | 즉시 폴백 데이터 반환 (요청 없이) |
| robots.txt 차단 감지 | `blocking=true`, note에 "(robots.txt 전면 차단 발견)" 추가 |
| URL HEAD 검증 실패 | `has_official_api=false`, note에 "(근거 URL 접근 불가)" 추가 |
| 전체 실패 | UI에 빨간색 오류 배너 표시 + 재시도 버튼 |

### 폴백 알고리즘 세부 구현

**`fallbackDifferentiation(competitors, githubResults)`**:
```typescript
const compCount = webSignalCount + githubSignalCount;

// competition_level 결정 (thresholds: 4, 12)
const level = compCount > 12 ? "red_ocean"
            : compCount > 4  ? "moderate"
            : "blue_ocean";

// 기본 점수: 경쟁자 1명당 7점 감소
const rawScore = Math.max(0, 100 - compCount * 7);

// level과 score 범위 강제 일치
const competition_score =
  level === "red_ocean" ? Math.min(rawScore, 39)        // 0~39
  level === "moderate"  ? Math.min(Math.max(rawScore, 40), 69)  // 40~69
                        : Math.max(rawScore, 70);        // 70~100
```

**`fallbackVerdict(feasibility, differentiation)`**:
```typescript
const avg = Math.floor((feasibility.score + differentiation.competition_score) / 2);

// high severity bottleneck 존재 시 GO 차단
const highSeverityCount = feasibility.bottlenecks.filter(b => b.severity === "high").length;

const rawVerdict = avg >= 70 ? "GO" : avg >= 40 ? "PIVOT" : "KILL";
const verdict = (rawVerdict === "GO" && highSeverityCount >= 1) ? "PIVOT" : rawVerdict;
// → timing 점수는 기본값 50 사용
```

---

## 12. `parseJsonSafe` 구현

Claude가 반환하는 텍스트에서 JSON을 추출하는 3단계 파서:

```typescript
function parseJsonSafe<T>(text: string, fallback: T): T {
  // 1단계: 직접 파싱
  try { return JSON.parse(text); } catch {}

  // 2단계: 마크다운 코드블록에서 추출
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1]); } catch {}
  }

  // 3단계: 첫 번째 { 부터 마지막 } 까지 추출
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }

  return fallback;
}
```

---

## 13. Tavily 크레딧 사용량 (전체 분석 1회)

| 용도 | 요청 수 | 깊이 | 크레딧 |
|------|---------|------|--------|
| 경쟁 제품 검색 Phase 1 | 2 (병렬) | basic | 2 |
| 경쟁 제품 검색 Phase 2 (희소 시 재시도) | 2 (병렬) | basic | 2 |
| 데이터 가용성 증거 검색 | 최대 6 (병렬) | basic | 6 |
| **합계** | | | **최대 10** |

---

## 14. 빌드 및 개발 명령어

```bash
npm install           # 의존성 설치
npm run dev           # 개발 서버 (localhost:3000)
npm run build         # 프로덕션 빌드 (TypeScript 체크 포함)
npm run start         # 프로덕션 서버 시작
npm run typecheck     # next typegen + tsc --noEmit
npm run test          # Vitest 단위/API 테스트 (1회)
npm run test:watch    # Vitest 워치 모드
npm run test:e2e      # Playwright E2E 테스트 (개발 서버 자동 시작)
```

---

## 15. 배포

- **플랫폼**: Vercel
- **Auto-deploy**: `main` 브랜치 push 시 자동 배포 (GitHub 연동)
- **Root Directory**: 반드시 비워둘 것 (서브디렉토리로 설정 시 자동 배포 깨짐)
- **수동 배포**: `npx vercel --prod`

---

## 16. 누락 파일 — `ThemeProvider.tsx` + `exportUtils.ts`

### `app/components/ThemeProvider.tsx`

specs에 언급되지 않은 별도 파일. `Header.tsx`와 `layout.tsx`가 의존함.

```typescript
// 타입 및 상수
export type ThemeId = "hackathon" | "indigo" | "cyber" | "hacker" | "slate";
export const THEMES = [
  { id: "hackathon", name: "오렌지",   color: "#f97316" },
  { id: "indigo",    name: "인디고",   color: "#6366f1" },
  { id: "cyber",     name: "블루",     color: "#0ea5e9" },
  { id: "hacker",    name: "그린",     color: "#22c55e" },
  { id: "slate",     name: "슬레이트", color: "#334155" },
];

// Context
const ThemeContext = createContext<{ theme: ThemeId; setTheme: (t: ThemeId) => void }>
  ({ theme: "hackathon", setTheme: () => {} });
export function useTheme() { return useContext(ThemeContext); }

// ThemeProvider (layout.tsx에서 children 감쌈)
// - 마운트 시 localStorage.getItem("v8-theme") 읽어 적용
// - setTheme: state + localStorage.setItem("v8-theme", t) + document.documentElement.setAttribute("data-theme", t)
// → 테마는 localStorage("v8-theme") 에 저장되어 세션 간 유지됨
```

**`layout.tsx` 구조**:
```tsx
<html lang="ko">
  <body>
    <ThemeProvider>{children}</ThemeProvider>
  </body>
</html>
// favicon: /shield.svg (public/ 디렉토리에 배치 필요)
// 메타데이터: title="Valid8 — 바이브코딩 실현성 분석기"
```

### `app/exportUtils.ts`

`page.tsx`에서 import하여 사용. 별도 파일로 분리됨.

**파일명 규칙**: `valid8_${idea.slice(0,20).replace(/\s+/g,"_")}_${YYYY-MM-DD}.md|.json`

**Markdown 내보내기 구조** (`exportAsMarkdown`):
```
# Valid8 분석 리포트
> **아이디어:** {idea}
> **생성일:** {ko-KR 로케일 날짜}

---
## 1단계: {title}
### 시장 조사 (웹) — raw_count, 경쟁사 최대 5개 (제목+URL+snippet)
### 오픈소스 조사 (GitHub) — repos 최대 5개 (이름+URL+별점+언어+설명)
### 차별화 분석 — competition_score, 레벨, 기존 솔루션, 차별화 포인트

---
## 2단계: {title}
점수, overall_feasibility, 바이브코딩 난이도
### 병목 지점 — [HIGH/MEDIUM] description → suggestion
### 데이터/API 가용성 — ✅/🔄/❌ 상태 + 블로커 경고
### 필요 기술, 리스크, 예상 개발 시간

---
## 3단계: {title}
🟢/🟡/🔴 {VERDICT} — {overall_score}/100
> {one_liner}
### 점수 상세 (경쟁/실현성/차별화/타이밍 표)
### 추천, 대안 아이디어

---
*Valid8에서 생성됨*
```

**JSON 내보내기 구조** (`exportAsJson`):
```json
{
  "idea": "string",
  "exported_at": "ISO 8601",
  "steps": [{ "step": 1-3, "title": "string", "result": {...} }]
}
```

**다운로드 구현** (`downloadFile`):
- `Blob` 생성 → `URL.createObjectURL` → `<a>` 태그 프로그래매틱 클릭 → `URL.revokeObjectURL`

---

## 17. ChatPanel 상세 — `useChat` 설정

```typescript
// DefaultChatTransport 사용 (TextStreamChatTransport가 아님)
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";

const transport = useMemo(() =>
  new DefaultChatTransport({
    api: "/api/chat",
    body: { analysisResults: resultsContext, idea },
  }),
  [resultsContext, idea]
);

const { messages, sendMessage, status } = useChat({ transport });
const isLoading = status === "submitted" || status === "streaming";
```

**`resultsContext` 구성**: `status === "done" && result`인 step만 `{ step, title, result }` 형태로 추출

**제안 질문 4개 (정확한 텍스트)**:
```
"MVP를 4시간 안에 만들 수 있는 최소 기능은?"
"가장 큰 기술적 리스크를 어떻게 해결할까?"
"경쟁사와 차별화할 킬러 기능은?"
"심사위원에게 어필할 데모 시나리오는?"
```

제안 질문은 `messages.length === 0`일 때만 표시됨.

**메시지 렌더링**:
- 사용자: 우측 정렬(ml-8), 브랜드 배경색
- AI: 좌측 정렬(mr-8), `bg-slate-50`, `ReactMarkdown`으로 렌더링
- AI 응답 중: "답변 생성 중..." 로딩 버블 표시 (마지막 메시지가 user일 때)
- 메시지 목록: `max-h-96 overflow-y-auto`, 새 메시지마다 `scrollIntoView({ behavior: "smooth" })`

**`/api/chat` 시스템 프롬프트 내용**:
```
당신은 Valid8 AI 분석 어시스턴트입니다. 사용자의 해커톤/사이드 프로젝트 아이디어에 대해 3단계 분석이 완료되었습니다.

분석 결과 컨텍스트:
{analysisResultsText}  ← JSON.stringify(sanitized, null, 2).slice(0, 12000)

원본 아이디어:
{idea}

위 분석 결과를 기반으로 사용자의 후속 질문에 답변하세요.
- 구체적인 기술 구현 방법, 차별화 전략, 피벗 방향 등을 조언하세요.
- 분석 결과에서 나온 데이터(점수, 경쟁사, 리스크 등)를 적극 인용하세요.
- 답변은 한국어로 하되, 기술 용어는 영어 원문을 병기하세요.
- 간결하고 실행 가능한 답변을 제공하세요.
```

---

## 18. IdeaInput 예시 칩 텍스트 + 버튼 문구

**예시 칩 4개 (정확한 텍스트)**:
```
"마크다운 기반의 이력서 생성기 웹앱"
"GitHub PR을 자동으로 리뷰해주는 봇"
"우주 쓰레기 궤도 통합 분석 시뮬레이터"
"Claude Code 세션 간 컨텍스트 자동 유지 도구"
```

예시 칩 클릭 → 텍스트에어리어에 채워지기만 함 (자동 제출 안 함, 직접 확인 필요)

**제출 버튼 문구**:
- 대기 중: `"바이브코딩(AI)으로 당장 구현 가능한가요?"`
- 분석 중: `"분석 중..."`

**텍스트에어리어 placeholder**: `"아이디어를 입력하세요... (Enter로 바로 검증)"`

---

## 19. 로딩 스켈레톤 상세

`isAnalyzing && steps.length === 0` (Pre-step 실행 중) 상태에서 단일 카드 표시:

```tsx
<div className="step-card animate-slide-up">
  {/* 헤더: Loader2 스피닝 아이콘 + "분석 준비 중" + "AI가 검색 전략을 준비하고 있습니다..." */}
  <div className="space-y-3">
    <div className="h-4 w-3/4 rounded shimmer-skeleton" />
    <div className="h-4 w-2/3 rounded shimmer-skeleton" />
    <div className="h-4 w-1/2 rounded shimmer-skeleton" />
  </div>
</div>
```

스켈레톤 줄 3개: 너비 각각 w-3/4, w-2/3, w-1/2 (점점 좁아지는 패턴)

---

## 20. `VerdictResult.confidence` 필드 처리

타입에는 `confidence: number` 필드가 정의되어 있으나, 프롬프트에서 명시적 규칙이 없음.
→ Claude가 자유롭게 0-100 범위로 생성. UI에서 현재 **직접 표시 안 함** (내부 데이터로만 존재).

---

## 21. `page.tsx` 전환 애니메이션 상세

```tsx
// 최대 너비 컨테이너
<div className="mx-auto max-w-3xl px-4 pb-20">

// 결과 있을 때 Header+Input 영역 축소
<div className={`transition-all duration-700 ease-in-out
  ${hasResults ? "pt-4 sm:pt-6" : "pt-[15vh] sm:pt-[20vh]"}`}>

// Input 영역 scale 0.95로 축소
<div className={`transition-all duration-700 ease-in-out origin-top
  ${hasResults ? "scale-[0.95] opacity-80 pb-6" : "scale-100 opacity-100 pb-12"}`}>
```

---

## 22. `VerdictResult.confidence` 제외 — `evaluateDataSourceWithRules` 사용 시점

`evaluateDataSourceWithRules` (`rules.ts`)는 현재 **`analyzer.ts`에서 직접 호출되지 않음**.
`checkDataAndLibraries`에서는 `getClaudeDataJudgment`(AI 판정)이 직접 사용됨.
→ 이 함수는 `rules.ts`에 존재하지만 메인 파이프라인에서 미사용 상태.
→ 재구현 시: AI 판정을 1차로 사용하고, `evaluateDataSourceWithRules`는 AI 없이 폴백 시 활용 가능.

---

## 23. 재구현 시 유의사항

### 반드시 지켜야 할 것
1. **SSE 클라이언트**: 브라우저 `EventSource` API 사용 불가 — POST 요청 필요 → `fetch()` + `getReader()` 수동 파싱
2. **판정 색상**: GO=`#10b981`, PIVOT=`#f59e0b`, KILL=`#f43f5e`는 디자인 일관성을 위해 고정
3. **사용자 텍스트**: 모든 UI 텍스트는 한국어
4. **AI 프롬프트 언어**: 한국어로 작성, JSON 출력만 요구
5. **모델 분류**: 간단한 쿼리 생성은 Haiku, 판단/스트리밍은 Sonnet
6. **`overall_feasibility` ↔ `score` 일관성**: 프롬프트에서 두 값이 반드시 매핑 범위 안에서 일치하도록 지시
7. **Step 1 결과 병합**: `web` + `github` + `differentiation`을 하나의 객체로 묶어 `step_result`로 전송
8. **ChatPanel 입력 제한**: messages JSON 60KB, analysisResults JSON 12KB 상한 적용

### 흔한 실수 피하기
- GitHub 검색: 단계적 조건 완화 없이 단일 쿼리만 쓰면 결과가 0개인 경우 많음
- Tavily 검색: `include_raw_content: true`로 설정해야 500자 snippet 확보 가능
- robots.txt 파싱: `Disallow: /`와 `Allow: /`가 동시 존재 시 `Allow`가 우선 (차단 아님)
- npm 검증: `category:...` 형식의 힌트 처리 필요, 정규식으로 유효한 패키지명 확인 후 레지스트리 조회
- VerdictCard: `scrollIntoView`를 `useEffect`에서 호출해야 애니메이션 후 자연스럽게 스크롤
- SSE `step_result` 이벤트: `data.step`과 `data.result` 모두 있어야 인식됨 (`step_progress`와 구분 기준)

### 성능 고려사항
- 웹 검색 + GitHub 검색: `Promise.all` 병렬 실행
- 데이터 가용성 검색: 최대 6 쿼리 `Promise.all` 병렬 실행
- Claude 판정 + npm 검증: `Promise.all` 병렬 실행
- 캐싱: 동일 아이디어 재분석 시 외부 API 호출 최소화
- 스트리밍 progress: 80자 누적마다 1회 이벤트 (너무 자주 보내면 클라이언트 부하)
