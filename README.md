# Valid8 — AI 해커톤 아이디어 검증기

해커톤/사이드 프로젝트 아이디어를 AI가 냉정하게 검증하는 웹 서비스.

웹 검색(경쟁 제품) + GitHub 검색(유사 프로젝트) + AI 분석(기술 실현성 / 차별화)을 3단계 파이프라인으로 수행하여 **GO / PIVOT / KILL / FORK** 판정을 내립니다.

## Tech Stack

- **Next.js 16** (App Router) + React 19 + TypeScript 5
- **Tailwind CSS 4**
- **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`) — `claude-sonnet-4-6`
- **Tavily API** (웹 검색) + **GitHub Search API v3**

## Quick Start

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.local.example .env.local
# .env.local에 API 키 입력:
#   ANTHROPIC_API_KEY=sk-ant-...
#   TAVILY_API_KEY=tvly-...
#   GITHUB_TOKEN=ghp_...          (선택)

# 3. 개발 서버 실행
npm run dev
```

http://localhost:3000 에서 확인. 별도 백엔드 서버 불필요.

## 분석 파이프라인

| 단계 | 내용 | 데이터 소스 |
|------|------|------------|
| Pre | AI 검색 키워드 생성 | Claude Haiku (`generateText`) |
| 1 | 시장 및 차별화 분석 | Tavily 웹 검색 + GitHub Search API + Claude Sonnet (`streamText`) |
| 2 | 기술 실현성 및 데이터 검증 | Tavily 데이터가용성 검색 + npm registry + Claude Sonnet (`streamText`) |
| 3 | 종합 판정 (GO/PIVOT/KILL/FORK) | Claude Sonnet (`streamText`) |
| Chat | AI 후속 상담 | Claude Sonnet (`streamText` via `/api/chat`) |

### Tavily 크레딧 소모 (1회 full 분석 기준)

| 용도 | 요청 수 | depth | 크레딧 |
|------|---------|-------|--------|
| 경쟁사 탐색 Phase 1 | 2 (병렬) | basic | 2 |
| 경쟁사 탐색 Phase 2 (sparse 시) | 2 (병렬) | basic | 2 |
| 데이터가용성 검증 | 최대 6 (병렬) | basic | 6 |
| **합계** | | | **최대 10** |

## Project Structure

```
app/
├── page.tsx                    # 메인 페이지
├── useAnalysis.ts              # SSE 스트리밍 + 상태 관리 훅
├── types.ts                    # TypeScript 인터페이스
├── components/
│   ├── Header.tsx              # 앱 헤더
│   ├── IdeaInput.tsx           # 아이디어 입력 폼
│   ├── StepCard.tsx            # 분석 단계 카드
│   ├── CompetitorList.tsx      # Step 1 — 경쟁 제품 + GitHub 목록
│   ├── GitHubList.tsx          # Step 1 — GitHub 프로젝트 목록
│   ├── FeasibilityCard.tsx     # Step 2 — 실현성 + 데이터가용성 분석
│   ├── DifferentiationCard.tsx # Step 1 — 차별화 분석
│   ├── VerdictCard.tsx         # Step 3 — 최종 판정
│   └── ChatPanel.tsx           # AI 후속 상담
└── api/
    ├── analyze/
    │   ├── route.ts            # POST — SSE 분석 엔드포인트
    │   ├── analyzer.ts         # IdeaAnalyzer 클래스 (3단계 파이프라인)
    │   ├── prompts.ts          # 한국어 프롬프트 템플릿 (8개 빌더)
    │   ├── rules.ts            # npm 패키지 후보 선택 규칙
    │   └── utils.ts            # JSON 파서, fallback, 캐시
    └── chat/
        └── route.ts            # POST — AI 후속 상담 엔드포인트
```

## Environment Variables

`.env.local`에 설정 (서버 사이드 전용):

| 변수 | 필수 | 설명 |
|------|------|------|
| `ANTHROPIC_API_KEY` | Yes | Claude API 키 (검색 쿼리 생성 + Steps 1-3) |
| `TAVILY_API_KEY` | Yes | Tavily 웹 검색 API 키 (Steps 1-2) |
| `GITHUB_TOKEN` | No | GitHub API 토큰 — rate limit 완화 (Step 1) |

## Scripts

```bash
npm run dev      # 개발 서버 (localhost:3000)
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 서버
npm run lint     # ESLint
```
