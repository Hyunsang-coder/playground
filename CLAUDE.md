# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**KillMyIdea** — 해커톤 아이디어를 냉정하게 검증하는 AI 웹 서비스.

웹 검색(경쟁 제품) + GitHub 검색(유사 프로젝트) + AI 분석(기술 실현성/차별화)을 5단계 파이프라인으로 수행하여, 최종 GO / PIVOT / KILL 판정을 내립니다.

핵심 차별점: 기존 아이디어 검증기는 비즈니스/스타트업 관점. 이 도구는 **해커톤/개발자 관점**에서 기술적 실현성 + 경쟁 코드 분석에 집중.

OKKY 바이브 코딩 해커톤 (2026.02.21, 4시간 개발) 출품작.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: FastAPI (Python) + SSE 스트리밍
- **AI**: Claude API (anthropic SDK)
- **Search**: Claude web_search (웹 검색) + GitHub Search API
- **Icons**: lucide-react

## Build & Dev Commands

```bash
# Frontend
cd frontend
npm run dev          # 개발 서버 (localhost:5173, proxy → :8000)
npm run build        # 프로덕션 빌드
npx tsc --noEmit     # TypeScript 타입 체크

# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Environment Variables

```bash
# backend/.env
ANTHROPIC_API_KEY=           # Claude API 키 (웹 검색 + AI 분석 통합)
GITHUB_TOKEN=                # GitHub API 토큰 (선택, rate limit 완화)
```

## Architecture

```
아이디어 입력 → POST /api/analyze (SSE 스트리밍)
  → Step 1: 웹 검색 (Claude web_search) — 경쟁 제품 탐색
  → Step 2: GitHub 검색 — 유사 오픈소스 프로젝트
  → Step 3: AI 기술 실현성 분석 (Claude web_search + 분석) — API 가용성/크롤링 가능 여부 검증 포함
  → Step 4: AI 차별화 분석 (Claude)
  → Step 5: 종합 판정 생성 (Claude)
  → SSE events: step_start → step_result → done
```

### Key Modules

- **`backend/main.py`**: FastAPI 서버, SSE 엔드포인트
- **`backend/analyzer.py`**: 5단계 분석 파이프라인
  - `_search_web()`: Claude web_search 경쟁 제품 검색
  - `_search_github()`: GitHub API 유사 프로젝트 검색
  - `_analyze_feasibility()`: Claude 기술 실현성 분석 (web_search로 API 가용성/크롤링 가능 여부 실시간 검증)
  - `_analyze_differentiation()`: Claude 차별화 + Devil's Advocate
  - `_generate_verdict()`: 종합 판정 GO/PIVOT/KILL
- **`frontend/src/useAnalysis.ts`**: SSE 스트리밍 파싱 훅
- **`frontend/src/components/`**: 단계별 결과 UI 컴포넌트

### Verdict System

- `overall_score` 0-100
- `GO` (🟢): 진행 — 초록 #22c55e
- `PIVOT` (🟡): 방향 전환 권장 — 노랑 #eab308
- `KILL` (🔴): 포기 권장 — 빨강 #ef4444

### Score Categories

- **competition**: 경쟁 현황 (낮을수록 레드오션)
- **feasibility**: 기술 실현성
- **differentiation**: 차별화 가능성
- **timing**: 타이밍 적절성

### API Contract

`POST /api/analyze` — 요청: `{ idea, mode }` — SSE 스트리밍 응답
- mode: `"hackathon"` | `"startup"` | `"sideproject"`
- events: `step_start`, `step_result`, `done`

## Important Conventions

- LLM 프롬프트 출력은 **반드시 순수 JSON**. 마크다운/코드블록 금지.
- UI는 다크 모드 기본. 숫자는 크게, 한눈에 들어오도록.
- 색상 의미 고정: GO(초록), PIVOT(노랑), KILL(빨강).

## Fallback Strategy

안정성 최우선:
1. **웹 검색 실패**: 빈 결과 + 오류 메시지
2. **GitHub API 실패**: 빈 결과 + 오류 메시지
3. **Claude API 실패**: 점수 기반 자동 fallback 판정
4. **전체 실패**: 에러 메시지 UI 표시
