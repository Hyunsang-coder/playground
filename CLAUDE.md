# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Review Detective** — AI 가짜 리뷰 판별기. 쿠팡/네이버 쇼핑 상품 URL을 입력하면 AI가 리뷰를 분석하여 가짜 리뷰를 판별하고, 진짜 리뷰만 기반으로 보정 평점과 장단점 요약을 제공하는 웹 서비스.

OKKY 바이브 코딩 해커톤 (2026.02.21, 4시간 개발) 출품작.

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS (dark mode default)
- **Crawling**: Puppeteer + puppeteer-extra-plugin-stealth
- **AI**: Claude API (@anthropic-ai/sdk)
- **Validation**: zod (LLM JSON 응답 스키마 검증)
- **Concurrency**: p-limit (LLM rate-limit 보호)
- **Charts**: Recharts
- **Icons**: lucide-react

## Build & Dev Commands

```bash
npm run dev          # 개발 서버 (localhost:3000)
npm run build        # 프로덕션 빌드
npm run lint         # ESLint
```

## Environment Variables

```bash
ANTHROPIC_API_KEY=       # Claude API 키
ANALYZE_MAX_REVIEWS=120  # 최대 수집 리뷰 수
LLM_BATCH_SIZE=12        # 배치당 리뷰 수
LLM_MAX_CONCURRENCY=2    # 동시 LLM 호출 수
```

## Architecture

```
URL 입력 → POST /api/analyze
  → validate(url)
  → crawlReviews(url, maxReviews)     — Puppeteer stealth 크롤링
  → normalizeReviews(raw)
  → heuristicPreScore(reviews)        — 규칙 기반 사전 점수
  → llmBatchAnalyze(reviews)          — 배치 12개씩 Claude API 병렬 호출
  → mergeScores + aggregate           — 가중 평균 (heuristic 20-30% + LLM 70-80%)
  → summarizeGenuineReviews           — 진짜 리뷰 기반 요약
  → return AnalysisResult JSON
```

### Key Modules

- **`src/lib/crawler/`**: 플랫폼별 Puppeteer 크롤러. 단일 상품 페이지에서 리뷰를 페이지네이션으로 수집 (최대 80-120개). 크롤링 실패 시 fallback 캐시 데이터 반환.
- **`src/lib/analyzer/`**: 2단계 분석 파이프라인.
  - `heuristic.ts`: 규칙 기반 신호 (프로모 톤, 반복 상품명, 평점-텍스트 불일치, 너무 짧은/일반적 리뷰 등)
  - `prompt.ts` + `batch-analyze.ts`: LLM 배치 분석. 배치 12개 단위로 `p-limit`으로 동시성 제어하며 `Promise.all` 병렬 호출.
  - `schema.ts`: zod 스키마로 LLM JSON 응답 강제 검증. 실패 시 1회 재시도 후 heuristic-only fallback.
  - `summarize.ts`: 진짜 리뷰(fakeScore < 70) 기반 장단점/추천대상/주의사항 요약.
- **`src/lib/cache/memory-store.ts`**: analysisId 기준 메모리 캐시. 중복 URL 즉시 응답.
- **`src/components/`**: 대시보드 UI 컴포넌트 — URL 입력, 로딩 상태, 평점 비교 카드, 도넛차트, 요약 카드, 개별 리뷰 리스트.

### Core Types (`src/lib/types.ts`)

- `RawReview`: 크롤링 원본 (text, rating 1-5, date, reviewer, helpfulCount, isPhotoReview, badgeText)
- `ReviewCategory`: `genuine | suspected_paid | suspected_ai | suspected_template | rating_mismatch`
- `AnalyzedReview`: RawReview + fakeScore(0-100), category, reason, confidence(0-1), signals[]
- `AnalysisResult`: productName, source, originalRating vs adjustedRating, fakePercentage, categoryBreakdown, summary(pros/cons/oneLiner/recommendFor/caution), reviews[]

### Score Thresholds

- `0-39`: 진짜 가능성 높음 (genuine)
- `40-69`: 의심 (suspected)
- `70-100`: 가짜 가능성 높음 (fake)
- 보정 평점 = `fakeScore < 70`인 리뷰의 평균 평점 (리뷰 수 < 15이면 전체 평균과 혼합)

### API Contract

`POST /api/analyze` — 요청: `{ url, maxReviews }` — 성공: `{ analysisId, result: AnalysisResult }` — 실패: `{ error: { code: "INVALID_URL|CRAWL_FAILED|LLM_FAILED|INTERNAL", message } }`

## Important Conventions

- 크롤링은 단건(단일 URL) 방식. 대량 크롤링 절대 금지.
- LLM 호출은 반드시 배치(12개) + `p-limit` 동시성 제어로 최적화. 리뷰 하나씩 개별 호출하지 않음.
- LLM 프롬프트 출력은 **반드시 JSON 배열**. 마크다운/설명문/코드블록 금지. 필드: `review_index`, `fake_score`, `category`, `reason`, `confidence`, `key_signals`.
- 가짜 리뷰를 "가짜"로 단정하지 않고 **"의심 리뷰"**로 표현. UI/프롬프트 모두 동일.
- UI는 다크 모드 기본. 숫자는 크게, 한눈에 들어오도록.
- 색상 의미 고정: 진짜(초록), 의심(노랑), 가짜(빨강).

## Fallback Strategy (데모 안정성)

안정성 최우선. 3단계 방어:
1. **크롤링 실패**: fixture JSON 자동 반환. 2회 연속 빈 결과 시 fixture 모드 전환.
2. **LLM 실패**: zod 파싱 실패 → 1회 재시도(축소 응답) → heuristic-only fallback. 전체 실패율 20% 이상 시 fixture 모드 전환.
3. **전체 실패**: fixture 결과 + "샘플 데이터 모드" 배지 표시.

## Detailed Plan

전체 구현 플랜, LLM 프롬프트 설계, UI 레이아웃, 데모 시나리오, 리스크 대응은 `PLAN.md` 참조.
