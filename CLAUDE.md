# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**낚시 판별기 (Clickbait Detector)** — YouTube 영상 제목이 약속한 내용과 실제 영상 내용의 일치도를 3중 분석(자막+댓글+메타데이터)으로 판별하는 AI 웹 서비스.

핵심 차별점: "낚시인지 판단해줘"를 통째로 묻지 않고, 제목의 약속(claim)을 분해 → 각각을 자막에서 검증 → 정량적 점수로 변환. "왜 이 점수인가"를 약속별로 설명 가능.

OKKY 바이브 코딩 해커톤 (2026.02.21, 4시간 개발) 출품작.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS (dark mode default)
- **YouTube Data**: googleapis (YouTube Data API v3)
- **Transcript**: youtube-transcript (자막 추출)
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
ANTHROPIC_API_KEY=           # Claude API 키
YOUTUBE_API_KEY=             # YouTube Data API v3 키
TRANSCRIPT_MAX_LENGTH=8000   # 자막 최대 글자수 (초과 시 샘플링)
LLM_MAX_CONCURRENCY=2       # 동시 LLM 호출 수
```

## Architecture

```
YouTube URL 입력 → POST /api/analyze
  → extractVideoId(url)
  → 캐시 확인 (메모리)
  → Promise.all([fetchMetadata, fetchTranscript])
  → fetchComments
  → Layer 1: calculateMetaScore (코드, 즉시)
  → Layer 2: analyzeTranscript (LLM 호출 1회)
  → Layer 3: analyzeComments (키워드 + 선택적 LLM 호출 1회)
  → combineFinalScore (가중 합산)
  → return AnalysisResult JSON
```

### Key Modules

- **`src/lib/youtube/`**: YouTube 데이터 수집
  - `fetch-metadata.ts`: YouTube Data API v3 — 메타데이터 + 댓글 최대 100개
  - `fetch-transcript.ts`: youtube-transcript — 자막 추출 + 긴 자막 샘플링
- **`src/lib/analyzer/`**: 3중 분석 파이프라인
  - `metadata-scorer.ts`: 순수 코드 — 자극적 단어, 문장부호, 이모지, 좋아요율
  - `transcript-analyzer.ts`: LLM 1회 — 제목 약속 추출 + 자막 대조 검증
  - `comment-analyzer.ts`: 키워드 필터링 + 선택적 LLM 1회 — 댓글 감성 분석
  - `prompt.ts`: LLM 프롬프트 템플릿 (자막 분석, 댓글 분석)
  - `schema.ts`: zod 스키마 (LLM JSON 응답 검증)
  - `score-combiner.ts`: 3개 레이어 가중 합산 + verdict 결정
- **`src/lib/cache/memory-store.ts`**: videoId 기준 메모리 캐시 (30분 TTL)
- **`src/lib/fixtures/demo-result.ts`**: 데모용 fixture 데이터
- **`src/components/`**: 대시보드 UI 컴포넌트

### Core Types (`src/lib/types.ts`)

- `VideoMetadata`: YouTube 영상 메타데이터
- `VideoComment`: 댓글 데이터
- `TranscriptSegment`: 자막 세그먼트
- `ClaimVerification`: 약속별 검증 결과 (claim, evidence, score, met)
- `TranscriptAnalysis`: 자막 분석 결과 (claims[], overallScore, summary)
- `CommentAnalysis`: 댓글 분석 결과 (keyword + AI)
- `MetadataAnalysis`: 메타데이터 분석 결과
- `AnalysisResult`: 종합 결과 (trustScore, verdict, 3개 레이어 상세)

### Score & Verdict

- trustScore 0-100 (높을수록 신뢰)
- `>= 70`: trustworthy (신뢰) — 초록
- `40-69`: suspect (의심) — 노랑
- `< 40`: clickbait (낚시) — 빨강

### Weight Distribution

- **3중 분석 모두 가능**: 자막 50% + 댓글 30% + 메타 20%
- **자막 없음**: 댓글 60% + 메타 40%
- **댓글 부족**: 자막 65% + 메타 35%

### API Contract

`POST /api/analyze` — 요청: `{ url }` — 성공: `{ analysisId, result: AnalysisResult }` — 실패: `{ error: { code, message } }`

## Important Conventions

- LLM 프롬프트 출력은 **반드시 순수 JSON**. 마크다운/코드블록 금지.
- 낚시를 "낚시"로 단정하지 않고 **"의심"**으로 표현. UI/프롬프트 동일.
- UI는 다크 모드 기본. 숫자는 크게, 한눈에 들어오도록.
- 색상 의미 고정: 신뢰(초록 #22c55e), 의심(노랑 #eab308), 낚시(빨강 #ef4444).

## Fallback Strategy (데모 안정성)

안정성 최우선. 3단계 방어:
1. **YouTube API 실패**: fixture JSON 자동 반환
2. **자막 없음**: 가중치 재분배 (댓글 60% + 메타 40%)
3. **LLM 실패**: zod 파싱 실패 → 1회 재시도 → 메타데이터+키워드 only fallback
4. **전체 실패**: fixture 결과 + "샘플 데이터 모드" 배지 표시

## Detailed Plan

전체 구현 플랜은 `PLAN.md` 참조.
