# Valid8 — 해커톤 아이디어 검증기

해커톤/사이드 프로젝트 아이디어를, 실제로 혼자 만들 수 있는지 관점에서 검증하는 AI 도구.

웹 검색(경쟁사) + GitHub 검색(유사 프로젝트) + AI 분석(바이브코딩 실현성 / 차별화)을 5단계 파이프라인으로 수행하여 최종 **GO / PIVOT / KILL** 판정을 내립니다.

## 핵심 차별점

기존 검증 도구는 스타트업/투자자 관점. Valid8은 혼자 만드는 개발자 관점 — 바이브코딩 난이도, AI가 막히는 병목 지점, 실제 구현 리스크에 집중합니다.

## 기술 스택

| 영역 | 기술 |
|---|---|
| **Frontend** | React 19 + TypeScript 5.7 + Vite 6 + Tailwind CSS 3.4 |
| **Backend** | FastAPI 0.115 (Python) + SSE streaming (`sse-starlette`) |
| **AI** | Claude API (`anthropic` SDK, `claude-sonnet-4-20250514`) |
| **검색** | Tavily API (웹 검색) + GitHub Search API v3 |
| **HTTP** | `httpx` (백엔드) + `fetch` + `ReadableStream` (프론트엔드) |

## 시작하기

### 사전 요구사항

- Node.js 18+
- Python 3.10+

### 환경 변수 설정

```bash
cp backend/.env.example backend/.env
```

`backend/.env` 파일에 API 키를 입력합니다:

| 변수 | 필수 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API 키 (AI 분석, 3-5단계) |
| `TAVILY_API_KEY` | Yes | Tavily 웹 검색 API 키 (1단계) |
| `GITHUB_TOKEN` | No | GitHub API 토큰 — 선택사항, rate limit 증가 (2단계) |

### 백엔드 실행

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속합니다. Vite 개발 서버가 `/api` 요청을 `localhost:8000`으로 프록시합니다.

## 분석 파이프라인

```
사용자 입력 → POST /api/analyze → SSE 스트리밍
  → 1단계: 웹 검색 (Tavily)          — 경쟁사 탐색
  → 2단계: GitHub 검색               — 유사 오픈소스 프로젝트
  → 3단계: 바이브코딩 실현성 분석     — 난이도, 병목 지점, 외부 의존성 리스크
  → 4단계: AI 차별화 분석            — Claude (Devil's Advocate)
  → 5단계: 최종 판정                  — Claude (GO / PIVOT / KILL)
```

## 판정 시스템

| 판정 | 점수 | 의미 |
|---|---|---|
| GO | 70+ | 진행하세요 |
| PIVOT | 40-69 | 방향 전환 권장 |
| KILL | 0-39 | 포기를 권합니다 |

평가 항목 (각 0-100):
- **경쟁 현황** — 경쟁이 적을수록 높은 점수
- **기술 실현성** — 구현 가능성
- **차별화** — 기존 솔루션 대비 차별점
- **타이밍** — 시장 진입 시기 적절성

## 분석 모드

| 모드 | 설명 |
|---|---|
| **해커톤** | 5시간 이내, 1인 개발자, 바이브코딩 환경 |
| **사이드 프로젝트** | 주말 개발, 1~2인, 배포까지 목표 |

## 프로젝트 구조

```
├── CLAUDE.md                    # Claude Code 가이드
├── README.md
├── backend/
│   ├── .env.example             # 환경 변수 템플릿
│   ├── requirements.txt         # Python 의존성
│   ├── pytest.ini               # pytest 설정
│   ├── main.py                  # FastAPI 서버
│   ├── analyzer.py              # 5단계 분석 파이프라인
│   └── tests/                   # 테스트 스위트 (66개)
│       ├── conftest.py          # 공통 fixtures
│       ├── test_unit.py         # 단위 테스트
│       ├── test_integration.py  # 통합 테스트 (모킹)
│       ├── test_api.py          # API 엔드포인트 테스트
│       ├── test_schema.py       # 스키마 검증 테스트
│       ├── test_live_smoke.py   # 실제 API 스모크 테스트
│       └── test_live_consistency.py  # 결과 일관성 테스트
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── App.tsx              # 루트 컴포넌트
        ├── useAnalysis.ts       # SSE 스트리밍 + 상태 관리
        ├── types.ts             # TypeScript 인터페이스
        └── components/
            ├── Header.tsx
            ├── IdeaInput.tsx
            ├── StepCard.tsx
            ├── CompetitorList.tsx
            ├── GitHubList.tsx
            ├── FeasibilityCard.tsx
            ├── DifferentiationCard.tsx
            └── VerdictCard.tsx
```

## 테스트

```bash
cd backend

# 모킹 기반 테스트 (API 키 불필요, 66개)
pytest -v --ignore=tests/test_live_smoke.py --ignore=tests/test_live_consistency.py

# 실제 API 스모크 테스트 (API 키 필요)
pytest -v -m live_api

# 전체 테스트
pytest -v
```

| 테스트 계층 | 설명 | 수량 | API 키 |
|---|---|---|---|
| 단위 테스트 | JSON 파서, fallback 로직, 입력 검증 | 28 | 불필요 |
| 통합 테스트 | 모킹 기반 전체 파이프라인 | 8 | 불필요 |
| API 테스트 | FastAPI 엔드포인트 + SSE 스트림 | 9 | 불필요 |
| 스키마 검증 | TypeScript 타입 정의 기반 구조 검증 | 14 | 불필요 |
| 스모크 테스트 | 샘플 아이디어 실제 API 실행 | 21 | 필요 |
| 일관성 테스트 | 동일 아이디어 반복 실행 구조 비교 | 4 | 필요 |

## 빌드

```bash
cd frontend
npm run build
```

## 라이선스

MIT
