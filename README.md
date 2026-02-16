# 진실성 필터 — YouTube Clickbait Detector

YouTube 영상 제목이 약속한 내용과 실제 영상 내용의 일치도를 **3중 분석**(자막 + 댓글 + 메타데이터)으로 판별하는 AI 웹 서비스입니다.

> OKKY 바이브 코딩 해커톤 2026 출품작

## 핵심 차별점

"낚시인지 판단해줘"를 통째로 묻지 않고, 제목의 **약속(claim)을 분해** → 각각을 자막에서 검증 → **정량적 점수**로 변환합니다. "왜 이 점수인가"를 약속별로 설명할 수 있습니다.

## 주요 기능

- **키워드 검색** — YouTube Search API로 영상 검색, 카드 UI로 결과 표시
- **비동기 신뢰도 점수** — 검색 결과 먼저 표시 후 각 영상의 점수를 비동기로 로딩
- **점수 필터** — 슬라이더로 특정 점수 이하 영상 숨기기
- **URL 직접 분석** — YouTube URL 입력 시 바로 상세 분석
- **상세 보기** — 카드 클릭 시 약속 검증, 댓글 감성, 메타데이터 상세 분석 화면
- **엣지케이스 대응** — 음악/Shorts/라이브/긴영상 등 유형별 분석 전략 자동 조정
- **LRU 캐싱** — 검색 캐시(10분) + 분석 캐시(30분) + 크기 제한

## 분석 파이프라인

```
키워드 검색 or URL 입력
  → YouTube Search API (검색) / extractVideoId (URL)
  → 영상 유형 감지 (Shorts, 음악, 라이브, 긴영상, 일반)
  → Promise.all([fetchMetadata, fetchTranscript, fetchComments])
  → Layer 1: calculateMetaScore     — 자극적 단어, 문장부호, 이모지, 좋아요율 (코드, 즉시)
  → Layer 2: analyzeTranscript      — 제목 약속 추출 + 자막 대조 (LLM 1회)
  → Layer 3: analyzeComments        — 키워드 필터링 + 감성 분석 (선택적 LLM 1회)
  → combineFinalScore               — 가중 합산 → trustScore 0-100
```

## 점수 체계

| 점수 범위 | 판정 | 색상 |
|-----------|------|------|
| 70-100 | 신뢰할 수 있음 (trustworthy) | 초록 `#22c55e` |
| 40-69 | 주의 필요 (suspect) | 노랑 `#eab308` |
| 0-39 | 낚시 의심 (clickbait) | 빨강 `#ef4444` |

### 가중치 분배

| 상황 | 자막 | 댓글 | 메타데이터 |
|------|------|------|-----------|
| 3중 분석 모두 가능 | 50% | 30% | 20% |
| 자막 없음 | — | 60% | 40% |
| 댓글 부족 | 65% | — | 35% |

## 기술 스택

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 4 (다크 모드 기본) |
| YouTube Data | googleapis (YouTube Data API v3) |
| Transcript | youtube-transcript (자막 추출) |
| AI | Claude API (@anthropic-ai/sdk) |
| Validation | zod (LLM JSON 응답 스키마 검증) |
| Charts | Recharts |
| Icons | lucide-react |

## 시작하기

### 필수 조건

- Node.js 18+
- YouTube Data API v3 키
- Anthropic API 키

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local 파일에 API 키 입력

# 개발 서버 실행
npm run dev
```

### 환경 변수

```env
ANTHROPIC_API_KEY=           # Claude API 키
YOUTUBE_API_KEY=             # YouTube Data API v3 키
TRANSCRIPT_MAX_LENGTH=8000   # 자막 최대 글자수 (초과 시 샘플링)
LLM_MAX_CONCURRENCY=2       # 동시 LLM 호출 수
```

## 프로젝트 구조

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts       # 분석 API (URL 또는 videoId)
│   │   └── search/route.ts        # 검색 API
│   ├── layout.tsx
│   ├── globals.css
│   └── page.tsx                   # 메인 페이지 (검색 → 결과 → 상세)
├── components/
│   ├── search-input.tsx           # 키워드/URL 통합 입력
│   ├── search-result-card.tsx     # 검색 결과 카드 (비동기 점수 배지)
│   ├── trust-score-filter.tsx     # 점수 슬라이더 필터
│   ├── trust-score-hero.tsx       # 신뢰도 게이지
│   ├── claim-verification-card.tsx# 약속별 검증 결과
│   ├── comment-sentiment-card.tsx # 댓글 감성 분석
│   ├── metadata-score-card.tsx    # 메타데이터 분석
│   ├── score-breakdown-chart.tsx  # 가중치 차트
│   ├── summary-card.tsx           # 종합 요약
│   ├── loading-state.tsx          # 분석 로딩 UI
│   └── url-input.tsx              # (레거시) URL 전용 입력
└── lib/
    ├── types.ts                   # 전체 타입 정의
    ├── analyzer/
    │   ├── analysis-pipeline.ts   # 통합 분석 파이프라인
    │   ├── edge-cases.ts          # 영상 유형 감지
    │   ├── metadata-scorer.ts     # 메타데이터 점수 (순수 코드)
    │   ├── transcript-analyzer.ts # 자막 LLM 분석
    │   ├── comment-analyzer.ts    # 댓글 키워드 + LLM 분석
    │   ├── score-combiner.ts      # 가중 합산
    │   ├── prompt.ts              # LLM 프롬프트 템플릿
    │   └── schema.ts              # zod 스키마
    ├── cache/
    │   └── memory-store.ts        # LRU 캐시 (검색 10분 + 분석 30분)
    ├── fixtures/
    │   └── demo-result.ts         # 데모용 fixture
    └── youtube/
        ├── fetch-metadata.ts      # 메타데이터 + 댓글 수집
        ├── fetch-transcript.ts    # 자막 추출 (자동자막 폴백)
        └── search.ts              # YouTube Search API + batch 보강
```

## Fallback 전략

안정성 최우선, 4단계 방어:

1. **YouTube API 실패** → fixture JSON 자동 반환
2. **자막 없음** → 가중치 재분배 (댓글 60% + 메타 40%)
3. **LLM 실패** → zod 파싱 실패 시 1회 재시도 → 메타데이터+키워드 only fallback
4. **전체 실패** → fixture 결과 + "샘플 데이터 모드" 배지 표시

## 라이선스

MIT
