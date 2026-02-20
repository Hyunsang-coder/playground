# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Valid8** — AI web service that ruthlessly validates hackathon ideas.

Performs web search (competitors) + GitHub search (similar projects) + AI analysis (technical feasibility / differentiation) through a 3-step pipeline, delivering a final GO / PIVOT / KILL / FORK verdict.

Key differentiator: Existing idea validators take a business/startup perspective. This tool focuses on **hackathon/developer perspective** — technical feasibility + competitive code analysis.

Built for the OKKY Vibe Coding Hackathon (2026.02.21, 4-hour development window).

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript 5
- **Styling**: Tailwind CSS 4
- **AI**: Vercel AI SDK (`ai` + `@ai-sdk/anthropic`)
  - `claude-sonnet-4-6`: streaming analysis (steps 1-3), data judgment, filtering
  - `claude-haiku-4-5-20251001`: lightweight tasks (search query generation, refinement)
- **Search**: Tavily API (web search) + GitHub Search API v3
- **HTTP Client**: native `fetch` (server-side Route Handlers + client-side SSE)
- **Icons**: `lucide-react`

## Project Structure

```
├── CLAUDE.md
├── .gitignore
├── package.json               # npm config
├── next.config.ts             # Next.js config (no rewrites needed)
├── tsconfig.json              # TypeScript config (strict)
├── postcss.config.mjs         # PostCSS with Tailwind
├── eslint.config.mjs          # ESLint config
├── .env.local                 # Environment variables (not committed)
└── app/
    ├── layout.tsx         # Root layout (lang="ko")
    ├── page.tsx           # Main page — routes between input and results views
    ├── globals.css        # Tailwind layers + custom component classes
    ├── types.ts           # All TypeScript interfaces for API data shapes
    ├── useAnalysis.ts     # Custom hook — SSE stream parsing + state management
    ├── components/
    │   ├── Header.tsx           # App title with shield-check icon
    │   ├── IdeaInput.tsx        # Idea textarea + example chips (always runs all 3 steps)
    │   ├── StepCard.tsx         # Step wrapper with icon/status/loading skeleton
    │   ├── CompetitorList.tsx   # Step 1 result — web competitor + GitHub cards
    │   ├── GitHubList.tsx       # Step 1 result — GitHub repo cards with stars
    │   ├── FeasibilityCard.tsx  # Step 2 result — score + tech requirements + risks
    │   ├── DifferentiationCard.tsx  # Step 1 result — competition level + devil's arguments
    │   ├── VerdictCard.tsx      # Step 3 result — final verdict badge + score bars
    │   └── ChatPanel.tsx        # AI follow-up chat after analysis
    └── api/
        ├── chat/
        │   └── route.ts         # POST — AI follow-up chat (Vercel AI SDK streamText)
        └── analyze/
            ├── route.ts         # POST — SSE streaming endpoint (validation → stream)
            ├── analyzer.ts      # IdeaAnalyzer class — 3-step pipeline
            ├── prompts.ts       # Korean prompt templates (8 prompt builders)
            ├── rules.ts         # npm package candidate selection logic
            └── utils.ts         # parseJsonSafe, fallback functions, cache, types
```

## Build & Dev Commands

```bash
npm install              # Install dependencies
npm run dev              # Dev server (localhost:3000)
npm run build            # Production build (TypeScript check + Next.js build)
npm run start            # Start production server
npm run typecheck        # TypeScript type check (next typegen + tsc --noEmit)
npm run test             # Run unit/API tests with Vitest (once)
npm run test:watch       # Run Vitest in watch mode
npm run test:e2e         # Run Playwright E2E tests (requires dev server or auto-starts one)
```

Test structure: `tests/unit/` (Vitest), `tests/api/` (Vitest), `tests/e2e/` (Playwright). E2E tests use `http://localhost:3000` and reuse an existing dev server if running.

No separate backend server needed — all API routes run as Next.js Route Handlers.

## Environment Variables

Required in `.env.local`:

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for AI analysis (search query generation, steps 1-3) |
| `TAVILY_API_KEY` | Yes | Tavily web search API key (steps 1-2) |
| `GITHUB_TOKEN` | No | GitHub API token — optional, increases rate limits (step 1) |

All variables are server-side only (no `NEXT_PUBLIC_` prefix needed).

## Architecture

### Request Flow

```
User input → POST /api/analyze { idea, enabledSteps } → SSE streaming response
  → Pre-step: AI search query generation (Claude Haiku generateText)
  → Step 1: Web search (Tavily) + GitHub search (GitHub API) — parallel
            + AI differentiation analysis (Claude Sonnet streamText)
  → Step 2: Data availability check (Tavily evidence search + npm registry)
            + AI feasibility analysis (Claude Sonnet streamText)
  → Step 3: Final verdict generation (Claude Sonnet streamText — GO/PIVOT/KILL/FORK)
  → SSE events: step_start → step_progress → step_result → ... → done

Analysis complete → ChatPanel appears
  → POST /api/chat { messages, analysisResults } → Vercel AI SDK streamText
```

### Tavily Credit Usage (per full analysis)

| Purpose | Requests | Depth | Credits |
|---------|----------|-------|---------|
| Competitor search Phase 1 | 2 (parallel) | basic | 2 |
| Competitor search Phase 2 (sparse retry) | 2 (parallel) | basic | 2 |
| Data availability evidence | up to 6 (parallel) | basic | 6 |
| **Total** | | | **max 10** |

### API Route Handlers

**`app/api/analyze/route.ts`** — Analysis endpoint:
- `POST /api/analyze`: SSE endpoint, accepts `{ idea: string, enabledSteps: number[] }`
- Request validation: `idea` max 500 characters
- Creates `IdeaAnalyzer` instance with `process.env` API keys
- Streams SSE via `ReadableStream` + `TextEncoder`

**`app/api/analyze/analyzer.ts`** — `IdeaAnalyzer` class:
- `analyze(idea, enabledSteps)`: Async generator yielding SSE events; skips disabled steps with fallback data
- `generateSearchQueries(idea)`: Pre-step — Claude Haiku `generateText()` generates optimized English search queries
- `searchWeb(idea, aiQueries)`: 4-phase web search — parallel Tavily calls (basic) → sparse refinement (basic retry) → Claude relevance filtering → deterministic reranking. Cached (10min TTL)
- `doWebSearchParallel(query1, query2, depth)`: Parallel Tavily search with dedup via `Promise.all`; independent `AbortSignal.timeout()` per request; `resp.ok` guard
- `refineSearchQueries(idea, currentResults)`: Claude Haiku `generateText()` — generates refined queries when initial results are sparse (<3)
- `filterRelevant(idea, competitors)`: Claude Sonnet `generateText()` — filters non-competitor results
- `rerankCompetitors(idea, competitors)`: Deterministic relevance scoring — boosts product/service signals, demotes blog/news/SNS noise
- `searchGithub(idea, aiQuery)`: GitHub Search API, sorted by stars descending, returns up to 10 repos. Cached (10min TTL)
- `checkDataAndLibraries(idea)`: 2-stage pipeline — Claude Sonnet extracts data sources/libraries → Tavily evidence search (max 6 queries, 2 per source) → Claude judgment + npm registry + robots.txt + URL HEAD verification. Cached (30min TTL)
- `callClaudeStream(prompt, fallback)`: `streamText()` + `textStream` async iteration, yields progress every ~80 chars
- `streamFeasibility(idea, dataAvailability)`: Step 2 — focuses on data availability result
- `streamDifferentiation(idea, competitors, githubResults)`: Step 1 — Devil's Advocate analysis
- `streamVerdict(idea, context)`: Step 3 — takes optional context per enabled step; skips unavailable data

**`app/api/analyze/prompts.ts`** — Prompt builders (8 functions):
- `buildSearchQueriesPrompt`, `buildRefineSearchQueriesPrompt`, `buildFilterRelevantPrompt`
- `buildDataExtractionPrompt`, `buildDataJudgmentPrompt` — data availability 2-stage pipeline
- `buildFeasibilityPrompt(idea, dataAvailability?)` — receives pre-verified data availability result
- `buildDifferentiationPrompt`, `buildVerdictPrompt(idea, context)` — verdict accepts partial context (only enabled steps)
- `buildDataVerificationPrompt` — standalone verification prompt (legacy, unused in main flow)

**`app/api/analyze/rules.ts`** — npm candidate selection:
- `selectNpmCandidate(query, candidates)`: Deterministic scoring to pick the best npm package candidate from search results; used in `validateLibraryOnNpm`

**`app/api/analyze/utils.ts`** — Utilities:
- `parseJsonSafe(text, fallback)`: 3-stage JSON parser (direct → code block → `{...}` extraction)
- `fallbackFeasibility/Differentiation/Verdict()`: Deterministic fallbacks when Claude is unavailable
- `cacheGet/cacheSet`: In-memory `Map` cache with 10-minute TTL
- Type definitions for pipeline data shapes

**`app/api/chat/route.ts`** — Follow-up chat:
- `POST /api/chat`: Accepts `{ messages, analysisResults }`, streams AI responses
- Uses Vercel AI SDK `streamText()` with analysis context as system prompt

### Frontend Architecture

**State Management**: Single `useAnalysis` custom hook manages all state:
- `steps: AnalysisStep[]` — accumulated step data
- `isAnalyzing: boolean` — loading state
- `error: string | null` — error message
- `analyze(idea, enabledSteps)` — triggers SSE streaming
- `reset()` — clears all state for a new analysis

**SSE Parsing** (`useAnalysis.ts`): Manual `ReadableStream` parsing (not EventSource API):
- Reads response body chunks via `getReader()`
- Splits on newlines, buffers incomplete lines
- Detects event type by inspecting parsed data structure:
  - `data.step + data.title` → `step_start` event
  - `data.step + data.text` → `step_progress` event
  - `data.step + data.result` → `step_result` event
  - `data.message === "분석 완료"` → `done` event

**Follow-up Chat** (`ChatPanel.tsx`):
- Uses `@ai-sdk/react` `useChat` hook with `TextStreamChatTransport`
- Appears after all enabled steps complete
- Sends analysis results as context to `/api/chat`
- Pre-defined suggested questions for quick interaction

**Component Hierarchy**:
```
Page
├── Header
├── IdeaInput (shown when no steps started)
│   └── Always submits all 3 steps (One-Click UX, no step selector)
└── StepCard[] (shown when analyzing or results exist)
    ├── Loading skeleton (while steps.length === 0 and isAnalyzing)
    ├── CompetitorList + DifferentiationCard  (step 1)
    ├── FeasibilityCard                        (step 2)
    ├── VerdictCard                            (step 3)
    └── ChatPanel                              (after all enabled steps done)
```

### TypeScript Types (`app/types.ts`)

All API response shapes are typed:
- `WebSearchResult` — `{ competitors: Competitor[], raw_count, summary }`
- `GitHubSearchResult` — `{ repos: GitHubRepo[], total_count, summary }`
- `FeasibilityResult` — `{ overall_feasibility, score, vibe_coding_difficulty, bottlenecks, tech_requirements, key_risks, time_estimate, summary, data_availability? }`
- `DifferentiationResult` — `{ competition_level, competition_score, existing_solutions, unique_angles, is_exact_match_found, summary }`
- `DataAvailabilityResult` — `{ data_sources: [{name, has_official_api, crawlable, blocking, evidence_url?, note}], libraries: [{name, available_on_npm, package_name?, note}], has_blocking_issues }`
- `VerdictResult` — `{ verdict, confidence, overall_score, scores: VerdictScores, one_liner, recommendation, alternative_ideas }`
- `AnalysisStep` — `{ step, title, description, status: "pending"|"loading"|"done", result?, progressText? }`

### API Contract

**`POST /api/analyze`**

Request body:
```json
{ "idea": "string", "enabledSteps": [1, 2, 3] }
```

`enabledSteps` is always `[1, 2, 3]` — the UI hardcodes all 3 steps (One-Click UX). The field is accepted by the API for forward compatibility but is not user-configurable.

SSE stream events (format: `data: {json}\n\n`):
- `step_start`: `{ "step": 1-3, "title": "string", "description": "string" }`
- `step_progress`: `{ "step": 1-3, "text": "AI 응답 생성 중... (N자)" }` (streaming progress)
- `step_result`: `{ "step": 1-3, "result": { ... } }` (result shape varies by step)
- `done`: `{ "message": "분석 완료" }`

**`POST /api/chat`**

Request body:
```json
{ "messages": [...], "analysisResults": [...] }
```

Response: Vercel AI SDK text stream.

### Verdict System

- `overall_score`: 0-100
- `GO` (🟢): Proceed — green `#22c55e`
- `PIVOT` (🟡): Pivot recommended — yellow `#eab308`
- `KILL` (🔴): Abandon recommended — red `#ef4444`
- `FORK` (🔵): Exact OSS match found — clone/fork instead of building from scratch

Score categories (each 0-100):
- **competition**: Competitive landscape (lower = more crowded / red ocean)
- **feasibility**: Technical feasibility
- **differentiation**: Differentiation potential
- **timing**: Market timing appropriateness

## Important Conventions

### LLM Prompts
- All Claude prompts require **pure JSON output only**. No markdown, no code blocks.
- The `parseJsonSafe` function handles cases where Claude wraps JSON in code blocks anyway.
- Prompts are written in Korean.
- Non-streaming calls use `generateText()` (search queries, refinement, filtering, data judgment).
- Streaming calls use `streamText()` + `textStream` iteration (steps 1-3).
- Model split: Haiku for simple/short tasks (`generateSearchQueries`, `refineSearchQueries`); Sonnet for judgment and streaming.

### UI/Design
- Light theme with white cards on subtle gray background.
- Numbers displayed prominently (`text-5xl font-black` or `text-6xl font-black`).
- Color semantics are fixed and consistent:
  - GO = green (`text-go`, `bg-go/*`, `border-go`)
  - PIVOT = yellow (`text-pivot`, `bg-pivot/*`, `border-pivot`)
  - KILL = red (`text-kill`, `bg-kill/*`, `border-kill`)
- Custom animations: `animate-fade-in`, `animate-slide-up`.

### Code Style
- Frontend: Functional components with named default exports. No class components.
- Server-side: Single-class design (`IdeaAnalyzer`), async throughout.
- All user-facing text is in Korean.
- TypeScript strict mode enabled.

### Dependencies
- All dependencies use caret (`^`) ranges in `package.json`.
- No separate backend dependencies — everything runs in Next.js.

## Fallback Strategy

Stability is the top priority. Each external service has independent fallback:

1. **Tavily API failure**: Returns empty competitor list + error message in `summary`
2. **GitHub API failure**: Returns empty repo list + error message in `summary`
3. **Claude API failure** (steps 1-3): Score-based automatic fallback using `fallback*()` functions
   - Feasibility defaults to score 50, "partial" feasibility
   - Differentiation calculates competition level from raw competitor+repo count
   - Verdict averages feasibility and differentiation scores: ≥70 → GO, ≥40 → PIVOT, <40 → KILL
4. **Missing API keys**: Detected at call time; returns fallback data without making requests
5. **Total failure**: Error message displayed in UI via red error banner

## Deployment

- **Platform**: Vercel (project name: `valid8`, org: `hyunsang-coders-projects`)
- **Production URL**: https://frontend-gules-six-15.vercel.app
- **Auto deploy**: Vercel GitHub integration on `main` branch push
- **Root Directory**: must be empty (repo root) — setting it to a subdirectory breaks auto deploy
- **Manual deploy**: `npx vercel --prod`

## Development Notes

- Single server: `npm run dev` starts Next.js on port 3000 with both frontend and API routes.
- No `.env.local` is committed; create `.env.local` and fill in API keys.
- SSE streaming uses `ReadableStream` + `TextEncoder` on server and manual `ReadableStream` parsing on the client (not the browser `EventSource` API, since POST requests are needed).
