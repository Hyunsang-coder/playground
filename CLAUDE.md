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
- **Charts**: Recharts
- **Icons**: lucide-react

## Build & Dev Commands

```bash
npm run dev          # 개발 서버 (localhost:3000)
npm run build        # 프로덕션 빌드
npm run lint         # ESLint
```

## Architecture

```
URL 입력 → /api/analyze (API Route)
  → Puppeteer stealth 크롤링 (리뷰 텍스트/평점/날짜/작성자)
  → 리뷰 10-20개씩 배치로 Claude API 호출 (가짜 의심도 스코어링)
  → 진짜 리뷰 필터링 → 요약 생성
  → 대시보드 UI 렌더링
```

### Key Modules

- **`src/lib/crawler/`**: 플랫폼별 Puppeteer 크롤러. 단일 상품 페이지에서 리뷰를 페이지네이션으로 수집 (최대 100-200개). 크롤링 실패 시 fallback 캐시 데이터 반환.
- **`src/lib/analyzer/`**: LLM 프롬프트 + 배치 분석 로직. 리뷰를 배치로 묶어 `Promise.all`로 병렬 호출. 각 리뷰에 fake_score(0-100)와 category(genuine/suspected_paid/suspected_ai/suspected_template/rating_mismatch) 부여.
- **`src/components/`**: 대시보드 UI 컴포넌트 — URL 입력, 로딩 상태, 평점 비교 카드, 도넛차트, 타임라인, 개별 리뷰 리스트.

### Core Types

`AnalysisResult` in `src/lib/types.ts` — 전체 분석 결과를 담는 메인 타입. originalRating vs adjustedRating, categoryBreakdown, reviewTimeline, summary(pros/cons), 개별 review 리스트 포함.

## Important Conventions

- 크롤링은 단건(단일 URL) 방식. 대량 크롤링 절대 금지.
- LLM 호출은 반드시 배치(10-20개) + 병렬로 최적화. 리뷰 하나씩 개별 호출하지 않음.
- 가짜 리뷰를 "가짜"로 단정하지 않고 "의심 리뷰"로 표현. UI/프롬프트 모두 동일.
- 크롤링 실패 시 fallback 캐시 데이터가 자동 반환되어야 함 (데모 안정성).
- UI는 다크 모드 기본. 숫자는 크게, 한눈에 들어오도록.

## Detailed Plan

전체 구현 플랜, LLM 프롬프트 설계, UI 레이아웃, 데모 시나리오, 리스크 대응은 `PLAN.md` 참조.
