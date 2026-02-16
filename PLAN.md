# AI 가짜 리뷰 판별기 — 실행 플랜 (개선판)

## 1. 프로젝트 개요

쿠팡/네이버 쇼핑 상품 URL을 입력하면 리뷰를 수집하고, AI + 규칙 기반 분석으로 의심 리뷰를 분류한 뒤, 신뢰 리뷰 중심의 요약과 보정 평점을 제공하는 웹 서비스.

핵심 메시지:
- "표시 평점"과 "보정 평점"의 차이를 직관적으로 보여준다.
- 의심 리뷰를 유형별로 설명 가능하게 제시한다.
- 긴 리뷰를 대신 읽어주는 구매 의사결정 도구를 만든다.

해커톤 정보:
- 일시: 2026년 2월 21일(토), 개발 시간 4시간 (13:20-17:20)
- 심사: 실용성(25) + 기술 완성도(25) + AI 활용도(25) + UX(20) + 차별성(5 가산)
- 발표: 2-3분

---

## 2. 성공 기준 (Definition of Done)

필수 성공 기준:
1. 쿠팡 URL 1개 입력 시 60개 이상 리뷰를 수집한다.
2. 리뷰별 `fake_score(0-100)`, `category`, `reason`을 생성한다.
3. `표시 평점`과 `보정 평점`을 한 화면에서 비교 표시한다.
4. 진짜 리뷰 기반 요약(장점/단점/추천대상/주의사항)을 제공한다.
5. 실패 시에도 데모가 끊기지 않도록 `fixture fallback`이 동작한다.

가산 성공 기준:
1. 네이버 쇼핑 URL 지원
2. 타임라인 차트(날짜별 의심 비율)
3. 실시간 진행률(SSE/폴링)

---

## 3. 범위 재정의 (MVP 우선)

### MVP (반드시 구현)
- 플랫폼: **쿠팡 우선 단일 지원**
- 리뷰 수집: 최대 80-120개
- 분석: 규칙 기반 신호 + LLM 배치 분석
- 결과: 보정 평점, 의심 비율, 카테고리 분포, 신뢰 리뷰 요약
- UI: 입력 페이지 + 결과 대시보드 1페이지

### Stretch (시간 남으면)
- 네이버 쇼핑 크롤러
- 개별 리뷰 상세 모달
- 타임라인 고도화
- 결과 캐시 영속화 (파일/kv)

### 명시적 비범위 (이번 해커톤에서 제외)
- 로그인/회원 기능
- 대규모 분산 크롤링
- 완전한 법적 컴플라이언스 자동화

---

## 4. 기술 스택 및 실행 원칙

| 구분 | 선택 | 비고 |
|------|------|------|
| 프레임워크 | Next.js 14 (App Router) + TypeScript | 빠른 풀스택 구현 |
| UI | Tailwind CSS + Recharts + lucide-react | 데모 시각화 중심 |
| 크롤링 | Puppeteer + puppeteer-extra-plugin-stealth | 동적 리뷰 렌더링 대응 |
| AI | Anthropic Claude API | 한국어 텍스트 판별/요약 |
| 검증 | zod | LLM JSON 스키마 검증 |
| 동시성 제어 | p-limit | LLM 호출 rate-limit 보호 |

실행 원칙:
- **Local-first 데모**: 크롤링은 로컬 Node 런타임 기준으로 구현한다.
- Vercel 배포는 결과 화면/입력 UX 중심으로만 사용하고, 데모 당일에는 로컬 실행을 기본 경로로 둔다.
- 모든 핵심 기능은 실패 대비 fallback(캐시/fixture)을 가진다.

---

## 5. 아키텍처

```text
[Client]
  URL 입력
    -> POST /api/analyze

[API Route]
  validate(url)
    -> crawlReviews(url, maxReviews)
    -> normalizeReviews(raw)
    -> heuristicPreScore(reviews)
    -> llmBatchAnalyze(reviews)
    -> mergeScores + aggregate
    -> summarizeGenuineReviews
    -> return AnalysisResult JSON

[UI]
  결과 카드 + 차트 + 리뷰 리스트 렌더링
```

핵심 개선점:
- 규칙 기반 사전 점수(Heuristic)를 넣어 LLM 오류 시에도 최소 기능 유지
- LLM 출력은 zod로 강제 검증 후, 실패 시 1회 재시도 + 축소 응답
- 분석 결과 전체를 `analysisId` 기준으로 메모리 캐시에 보관해 재요청 즉시 응답

---

## 6. 데이터 계약 (타입)

```ts
export interface RawReview {
  id: string;
  text: string;
  rating: 1 | 2 | 3 | 4 | 5;
  date: string; // YYYY-MM-DD
  reviewer?: string;
  helpfulCount?: number;
  isPhotoReview?: boolean;
  badgeText?: string; // 체험단/구매인증 등
}

export interface ReviewSignals {
  hasSpecificUsage: boolean;
  hasPromoTone: boolean;
  repeatedProductName: boolean;
  ratingTextMismatch: boolean;
  veryShortOrGeneric: boolean;
}

export type ReviewCategory =
  | "genuine"
  | "suspected_paid"
  | "suspected_ai"
  | "suspected_template"
  | "rating_mismatch";

export interface AnalyzedReview extends RawReview {
  fakeScore: number; // 0-100
  category: ReviewCategory;
  reason: string;
  confidence: number; // 0-1
  signals: string[];
}

export interface AnalysisResult {
  productName: string;
  productImage?: string;
  source: "coupang" | "naver" | "fixture";
  totalReviews: number;
  originalRating: number;
  adjustedRating: number;
  fakePercentage: number;
  categoryBreakdown: Record<ReviewCategory, number>;
  summary: {
    pros: string[];
    cons: string[];
    oneLiner: string;
    recommendFor: string;
    caution: string;
  };
  reviews: AnalyzedReview[];
}
```

스코어 해석 기준:
- `0-39`: 진짜 가능성 높음
- `40-69`: 의심
- `70-100`: 가짜 가능성 높음

보정 평점 계산:
- 기본: `fakeScore < 70`인 리뷰의 평균 평점
- 보완: 리뷰 수가 너무 적으면(`n < 15`) 전체 평균과 혼합

---

## 7. 구현 일정 (당일 4시간 타임박스)

### 13:20-13:40 (20분) — 부트스트랩
- Next.js 프로젝트 생성
- 필수 패키지 설치 (`puppeteer`, `@anthropic-ai/sdk`, `zod`, `p-limit`)
- 기본 라우트/타입 파일 생성

완료 기준:
- `/` 페이지와 `/api/analyze`가 정상 응답

### 13:40-14:30 (50분) — 쿠팡 크롤러 MVP
- 리뷰 영역 진입 + 페이지네이션 + 최대 80-120개 수집
- 셀렉터 실패 대비 안전 파싱(옵셔널 체이닝/기본값)
- 타임아웃/재시도(페이지 전환 1회 재시도)

완료 기준:
- 실 URL 기준 리뷰 60개 이상 JSON 추출

### 14:30-15:20 (50분) — 분석 파이프라인
- 규칙 기반 신호 계산
- LLM 배치 분석(배치 12개 권장)
- zod 검증 + 실패 재시도 + merge
- 보정 평점/카테고리 집계 계산

완료 기준:
- `AnalysisResult` 스키마로 응답 가능

### 15:20-16:10 (50분) — 결과 UI
- 상단 KPI 카드(표시 vs 보정 평점, 의심 비율)
- 도넛 차트(카테고리 비율)
- 요약 카드(장단점/추천대상/주의사항)
- 리뷰 리스트(점수/카테고리/근거)

완료 기준:
- URL 1개 입력부터 결과 렌더링까지 end-to-end 동작

### 16:10-16:40 (30분) — 안정화
- 크롤링 실패 시 fixture fallback
- LLM 실패 시 heuristic-only fallback
- 에러 메시지 사용자 친화화

완료 기준:
- 네트워크/크롤링/LLM 중 1개 실패해도 데모 진행 가능

### 16:40-17:20 (40분) — 데모 리허설
- 데모용 URL 2개 + fixture 1개 준비
- 발표 대본 확정
- 스크린 전환/로딩 시간 점검

완료 기준:
- 2-3분 시연 2회 연속 성공

---

## 8. 구현 상세

### 8.1 프로젝트 초기 명령어

```bash
npx create-next-app@latest review-detective --typescript --tailwind --app --src-dir
cd review-detective
npm i puppeteer puppeteer-extra puppeteer-extra-plugin-stealth @anthropic-ai/sdk zod p-limit recharts lucide-react
```

### 8.2 디렉토리 구조

```text
src/
├── app/
│   ├── page.tsx
│   ├── result/[id]/page.tsx
│   └── api/
│       └── analyze/route.ts
├── lib/
│   ├── crawler/
│   │   ├── coupang.ts
│   │   └── naver.ts            # stretch
│   ├── analyzer/
│   │   ├── heuristic.ts
│   │   ├── prompt.ts
│   │   ├── batch-analyze.ts
│   │   ├── schema.ts
│   │   └── summarize.ts
│   ├── cache/
│   │   └── memory-store.ts
│   └── types.ts
└── components/
    ├── url-input.tsx
    ├── loading-state.tsx
    ├── kpi-cards.tsx
    ├── category-donut.tsx
    ├── summary-card.tsx
    └── review-table.tsx
```

### 8.3 API 계약

`POST /api/analyze`

요청:
```json
{
  "url": "https://...",
  "maxReviews": 100
}
```

성공 응답:
```json
{
  "analysisId": "anl_xxx",
  "result": { "...AnalysisResult" }
}
```

실패 응답:
```json
{
  "error": {
    "code": "INVALID_URL | CRAWL_FAILED | LLM_FAILED | INTERNAL",
    "message": "사용자 친화 메시지"
  }
}
```

### 8.4 환경 변수

```bash
ANTHROPIC_API_KEY=
ANALYZE_MAX_REVIEWS=120
LLM_BATCH_SIZE=12
LLM_MAX_CONCURRENCY=2
```

---

## 9. AI 분석 설계

### 9.1 2단계 판별 전략
1. Heuristic 사전 점수(20-30% 가중치)
2. LLM 판별 점수(70-80% 가중치)
3. 최종 `fakeScore = weighted average`

효과:
- LLM 응답 실패/지연에도 최소 판별 가능
- 해석 가능성(어떤 신호 때문에 점수가 올라갔는지) 개선

### 9.2 LLM 프롬프트 원칙
- 입력: 배치 리뷰 배열 (최대 12개)
- 출력: **반드시 JSON 배열**
- 필드 강제: `review_index`, `fake_score`, `category`, `reason`, `confidence`, `key_signals`
- 금지: 마크다운/설명문/코드블록

### 9.3 안정성 장치
- zod 파싱 실패 시:
  1) 동일 배치 1회 재시도(응답 길이 축소)
  2) 실패 시 heuristic-only로 임시 판정
- 전체 실패율 20% 이상이면 즉시 fixture 모드로 전환

---

## 10. UI/UX 설계

핵심 화면:
1. 입력 화면: URL 입력 + 샘플 URL 버튼 + 지원 플랫폼 안내
2. 결과 화면: KPI 카드, 카테고리 도넛, 요약 카드, 리뷰 리스트

시각 설계 원칙:
- 첫 화면 3초 내 핵심 숫자 노출 (`표시 4.7 -> 보정 3.9`)
- 색상 의미 고정: 진짜(초록), 의심(노랑), 가짜(빨강)
- 텍스트는 "근거 중심" 짧은 문장으로

로딩 UX:
- 단계 텍스트 3개 고정 노출 (수집 -> 분석 -> 리포트)
- 실제 수치 실시간 연동은 stretch로 분리

---

## 11. 성능/비용 목표

성능 목표:
- 크롤링: 20-35초 (80-120개)
- LLM 분석: 15-30초
- 전체: 45-70초 내 결과

비용 가드:
- 데모 중 분석 횟수 상한(예: 10회)
- 배치 크기/동시성 상한 고정
- 중복 URL은 캐시 우선 반환

---

## 12. 테스트 전략

필수 테스트:
1. URL 검증 테스트 (`coupang`/`naver`/잘못된 URL)
2. 크롤러 파서 테스트 (fixture HTML 기반)
3. 스코어 집계 단위 테스트 (보정 평점/비율)
4. LLM 응답 파싱 테스트 (정상/깨진 JSON)
5. E2E 수동 테스트 (실 URL 1개 + fixture 1개)

수동 점검 체크:
- 빈 리뷰/짧은 리뷰에서도 크래시 없음
- 분석 실패 시 사용자 메시지 명확
- 모바일 뷰에서도 KPI/요약 가독성 유지

---

## 13. 리스크 대응 (실행형)

| 리스크 | 트리거 | 즉시 대응 | 최종 대응 |
|--------|--------|-----------|-----------|
| 크롤링 차단 | 2회 연속 빈 결과 | user-agent/대기시간 조정 | fixture 모드 전환 |
| DOM 변경 | selector miss > 30% | 대체 셀렉터 세트 적용 | 데모는 캐시 결과 사용 |
| LLM 지연/실패 | 호출 타임아웃 | 배치 축소, 동시성 1 | heuristic-only + 사유 노출 |
| API 비용 급증 | 호출 횟수 임계 초과 | 캐시 우선 응답 | 데모 URL 고정 운영 |
| 빌드/배포 실패 | 런타임 에러 | 로컬 실행 전환 | 녹화 GIF 백업 |

---

## 14. 데모 시나리오 (2-3분)

### 오프닝 (20초)
"리뷰는 많은데, 어떤 리뷰를 믿어야 할지 판단이 어렵습니다. 이 도구는 의심 리뷰를 걸러내고 진짜 리뷰 기준 점수를 다시 계산합니다."

### 본 데모 (90-110초)
1. 쿠팡 URL 입력
2. 분석 실행 (로딩 단계 노출)
3. 결과 설명:
   - 표시 평점 vs 보정 평점 비교
   - 의심 리뷰 비율 + 유형 분포
   - 진짜 리뷰 기반 장단점 요약
4. 리뷰 1건 근거 강조 (왜 의심인지)

### 클로징 (20초)
"결론적으로, 리뷰의 양이 아니라 신뢰도를 기준으로 더 안전한 구매 결정을 돕습니다."

### 플랜 B (필수)
- 실시간 크롤링 실패 시 즉시 fixture 결과로 전환
- 화면에 "샘플 데이터 모드" 배지 표시

---

## 15. 해커톤 전 준비 체크리스트 (2026-02-19까지)

1. [ ] 쿠팡 리뷰 셀렉터 2세트 확보(기본/대체)
2. [ ] 데모 URL 2개 + fixture JSON 1개 준비
3. [ ] Claude API 키/한도 확인
4. [ ] 프롬프트와 zod 스키마 사전 검증
5. [ ] 2-3분 발표 스크립트 확정
6. [ ] 로컬 실행 커맨드/환경변수 README 정리

---

## 16. 실행 체크포인트 (당일)

- 14:30 체크: 크롤러 미완성이면 네이버 지원 즉시 포기, 쿠팡 고정
- 15:20 체크: LLM 불안정하면 Heuristic 비중 상향 후 UI 완성 우선
- 16:10 체크: 실데이터가 불안하면 fixture-first 데모로 전환
- 16:40 체크: 기능 추가 중단, 발표 리허설만 수행
