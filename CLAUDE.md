# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**KillMyIdea** — AI web service that ruthlessly validates hackathon ideas.

Performs web search (competitors) + GitHub search (similar projects) + AI analysis (technical feasibility / differentiation) through a 5-step pipeline, delivering a final GO / PIVOT / KILL verdict.

Key differentiator: Existing idea validators take a business/startup perspective. This tool focuses on **hackathon/developer perspective** — technical feasibility + competitive code analysis.

Built for the OKKY Vibe Coding Hackathon (2026.02.21, 4-hour development window).

## Tech Stack

- **Frontend**: React 19 + TypeScript 5.7 + Vite 6 + Tailwind CSS 3.4
- **Backend**: FastAPI 0.115 (Python) + SSE streaming via `sse-starlette`
- **AI**: Claude API (`anthropic` SDK, model: `claude-sonnet-4-20250514`)
- **Search**: Tavily API (web search) + GitHub Search API v3
- **HTTP Client**: `httpx` (async, backend) + native `fetch` with `ReadableStream` (frontend)
- **Icons**: `lucide-react`

## Project Structure

```
├── CLAUDE.md
├── .gitignore
├── backend/
│   ├── .env.example          # Environment variable template
│   ├── requirements.txt      # Python dependencies (pinned versions)
│   ├── main.py               # FastAPI server, CORS, SSE endpoint, health check
│   └── analyzer.py           # IdeaAnalyzer class — 5-step analysis pipeline
└── frontend/
    ├── index.html             # Entry HTML (lang="ko", dark class on <html>)
    ├── package.json           # npm config (type: "module")
    ├── tsconfig.json          # TypeScript config (strict, ES2020 target)
    ├── vite.config.ts         # Vite config with /api proxy to localhost:8000
    ├── tailwind.config.js     # Custom colors (go/pivot/kill), animations
    ├── postcss.config.js      # PostCSS with Tailwind + autoprefixer
    └── src/
        ├── main.tsx           # React entrypoint (StrictMode)
        ├── App.tsx            # Root component — routes between input and results views
        ├── index.css          # Tailwind layers + custom component classes + scrollbar
        ├── types.ts           # All TypeScript interfaces for API data shapes
        ├── useAnalysis.ts     # Custom hook — SSE stream parsing + state management
        └── components/
            ├── Header.tsx           # App title with skull icon
            ├── IdeaInput.tsx        # Idea textarea + mode selector + example chips
            ├── StepCard.tsx         # Step wrapper with icon/status/loading skeleton
            ├── CompetitorList.tsx   # Step 1 result — web competitor cards
            ├── GitHubList.tsx       # Step 2 result — GitHub repo cards with stars
            ├── FeasibilityCard.tsx  # Step 3 result — score + tech requirements + risks
            ├── DifferentiationCard.tsx  # Step 4 result — competition level + devil's arguments
            └── VerdictCard.tsx      # Step 5 result — final verdict badge + score bars
```

## Build & Dev Commands

```bash
# Frontend
cd frontend
npm install              # Install dependencies
npm run dev              # Dev server (localhost:5173, proxies /api → :8000)
npm run build            # Production build (runs tsc -b first, then vite build)
npm run preview          # Preview production build
npx tsc --noEmit         # TypeScript type check only

# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

There are no test suites, linters, or formatters configured in this project.

## Environment Variables

Required in `backend/.env` (see `backend/.env.example`):

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for AI analysis (steps 3-5) |
| `TAVILY_API_KEY` | Yes | Tavily web search API key (step 1) |
| `GITHUB_TOKEN` | No | GitHub API token — optional, increases rate limits (step 2) |

## Architecture

### Request Flow

```
User input → POST /api/analyze { idea, mode } → SSE streaming response
  → Step 1: Web search (Tavily)        — competitor discovery
  → Step 2: GitHub search              — similar open-source projects
  → Step 3: AI feasibility analysis    — Claude (technical implementation analysis)
  → Step 4: AI differentiation analysis — Claude (Devil's Advocate perspective)
  → Step 5: Final verdict generation   — Claude (aggregate GO/PIVOT/KILL)
  → SSE events: step_start → step_result → ... → done
```

### Backend Modules

**`backend/main.py`** — FastAPI application:
- `POST /api/analyze`: SSE endpoint, accepts `{ idea: str, mode: str }`, streams events
- `GET /health`: Health check endpoint returning `{ status: "ok" }`
- CORS configured with permissive `allow_origins=["*"]`
- Request validation: `idea` max 500 characters, `mode` must be one of `hackathon`/`startup`/`sideproject`
- Creates a new `IdeaAnalyzer` instance per request with env-based API keys

**`backend/analyzer.py`** — `IdeaAnalyzer` class:
- `analyze(idea, mode)`: Async generator yielding SSE events for each pipeline step
- `_search_web(idea)`: Two Tavily API calls (general + competitor-focused), deduplicates by URL, returns up to 10 results
- `_search_github(idea)`: GitHub Search API, sorted by stars descending, returns up to 10 repos
- `_analyze_feasibility(idea, mode, competitors, github_results)`: Claude prompt for technical feasibility scoring
- `_analyze_differentiation(idea, competitors, github_results)`: Claude prompt with Devil's Advocate framing
- `_generate_verdict(idea, mode, competitors, github_results, feasibility, differentiation)`: Claude prompt for final judgment
- `_parse_json_safe(text, fallback)`: Robust JSON parser — tries direct parse, markdown code block extraction, then `{...}` extraction
- `_fallback_*()` methods: Deterministic fallback results when Claude API is unavailable

### Frontend Architecture

**State Management**: Single `useAnalysis` custom hook manages all state:
- `steps: AnalysisStep[]` — accumulated step data
- `isAnalyzing: boolean` — loading state
- `error: string | null` — error message
- `analyze(idea, mode)` — triggers SSE streaming
- `reset()` — clears all state for a new analysis

**SSE Parsing** (`useAnalysis.ts`): Manual `ReadableStream` parsing (not EventSource API):
- Reads response body chunks via `getReader()`
- Splits on newlines, buffers incomplete lines
- Detects event type by inspecting parsed data structure:
  - `data.step + data.title` → `step_start` event
  - `data.step + data.result` → `step_result` event
  - `data.message === "분석 완료"` → `done` event

**Component Hierarchy**:
```
App
├── Header
├── IdeaInput (shown when no results)
│   └── Mode selector (hackathon / startup / sideproject)
└── StepCard[] (shown when results exist)
    ├── CompetitorList    (step 1)
    ├── GitHubList        (step 2)
    ├── FeasibilityCard   (step 3)
    ├── DifferentiationCard (step 4)
    └── VerdictCard       (step 5)
```

### TypeScript Types (`frontend/src/types.ts`)

All API response shapes are typed:
- `WebSearchResult` — `{ competitors: Competitor[], raw_count, summary }`
- `GitHubSearchResult` — `{ repos: GitHubRepo[], total_count, summary }`
- `FeasibilityResult` — `{ overall_feasibility, score, tech_requirements, key_risks, time_estimate, summary }`
- `DifferentiationResult` — `{ competition_level, competition_score, existing_solutions, unique_angles, devil_arguments, pivot_suggestions, summary }`
- `VerdictResult` — `{ verdict, confidence, overall_score, scores: VerdictScores, one_liner, recommendation, alternative_ideas }`
- `AnalysisStep` — `{ step, title, description, status: "pending"|"loading"|"done", result?, progressText? }`

### API Contract

**`POST /api/analyze`**

Request body:
```json
{ "idea": "string", "mode": "hackathon" | "startup" | "sideproject" }
```

SSE stream events:
- `step_start`: `{ "step": 1-5, "title": "string", "description": "string" }`
- `step_result`: `{ "step": 1-5, "result": { ... } }` (result shape varies by step)
- `done`: `{ "message": "분석 완료" }`

Mode context mapping:
- `hackathon` → 4시간 해커톤 (1인 개발자)
- `startup` → 초기 스타트업 (3-5명 팀, 3개월)
- `sideproject` → 사이드 프로젝트 (1-2명, 주말 개발)

### Verdict System

- `overall_score`: 0-100
- `GO` (🟢): Proceed — green `#22c55e`
- `PIVOT` (🟡): Pivot recommended — yellow `#eab308`
- `KILL` (🔴): Abandon recommended — red `#ef4444`

Score categories (each 0-100):
- **competition**: Competitive landscape (lower = more crowded / red ocean)
- **feasibility**: Technical feasibility
- **differentiation**: Differentiation potential
- **timing**: Market timing appropriateness

## Important Conventions

### LLM Prompts
- All Claude prompts require **pure JSON output only**. No markdown, no code blocks.
- The `_parse_json_safe` method handles cases where Claude wraps JSON in code blocks anyway.
- Prompts are written in Korean.

### UI/Design
- **Dark mode by default** — `dark` class on `<html>`, `bg-gray-950` base.
- Numbers displayed prominently (`text-5xl font-black` or `text-6xl font-black`).
- Color semantics are fixed and consistent:
  - GO = green (`text-go`, `bg-go/*`, `border-go`)
  - PIVOT = yellow (`text-pivot`, `bg-pivot/*`, `border-pivot`)
  - KILL = red (`text-kill`, `bg-kill/*`, `border-kill`)
- Custom Tailwind colors defined in `tailwind.config.js`: `go`, `pivot`, `kill`.
- Custom CSS component classes in `index.css`: `.step-card`, `.verdict-badge`, `.score-ring`.
- Custom animations: `animate-fade-in` (0.5s), `animate-slide-up` (0.4s), `animate-pulse-slow` (3s), `animate-verdict-reveal` (0.8s), `animate-score-count` (1.2s), `animate-verdict-glow` (2s infinite).

### Code Style
- Frontend: Functional components with named default exports. No class components.
- Backend: Single-class design (`IdeaAnalyzer`), async throughout.
- All user-facing text is in Korean.
- TypeScript strict mode enabled; `noUnusedLocals` and `noUnusedParameters` are disabled.

### Dependencies
- Backend dependencies are pinned to exact minor versions in `requirements.txt`.
- Frontend dependencies use caret (`^`) ranges in `package.json`.

## Fallback Strategy

Stability is the top priority. Each external service has independent fallback:

1. **Tavily API failure**: Returns empty competitor list + error message in `summary`
2. **GitHub API failure**: Returns empty repo list + error message in `summary`
3. **Claude API failure** (steps 3-5): Score-based automatic fallback verdict using `_fallback_*()` methods
   - Feasibility defaults to score 50, "partial" feasibility
   - Differentiation calculates competition level from raw competitor+repo count
   - Verdict averages feasibility and differentiation scores: ≥70 → GO, ≥40 → PIVOT, <40 → KILL
4. **Missing API keys**: Detected at call time; returns fallback data without making requests
5. **Total failure**: Error message displayed in UI via red error banner

## Development Notes

- The Vite dev server proxies `/api` requests to `http://localhost:8000` — run both frontend and backend servers during development.
- No `.env` file is committed; copy `backend/.env.example` to `backend/.env` and fill in keys.
- The `frontend/public/skull.svg` is used as the favicon.
- SSE streaming uses `sse-starlette` on the backend and manual `ReadableStream` parsing on the frontend (not the browser `EventSource` API, since POST requests are needed).
