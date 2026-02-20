"use client";

import { useState } from "react";
import Header from "../components/Header";
import StepCard from "../components/StepCard";
import ChatPanel from "../components/ChatPanel";
import type { AnalysisStep } from "../types";

// ── Mock datasets ──────────────────────────────────────────────

const MOCK_SCENARIOS: Record<string, { label: string; idea: string; steps: AnalysisStep[] }> = {
  "claude-session": {
    label: "Claude Code 세션 컨텍스트 도구 (HIGH severity, GO→PIVOT 기대)",
    idea: "Claude Code 세션 간 컨텍스트 자동 유지 도구",
    steps: [
      {
        step: 1,
        title: "시장 및 차별화 분석",
        description: "웹 & GitHub 탐색 완료",
        status: "done",
        result: {
          web: {
            competitors: [
              { title: "CogmemAi — Cognitive Memory for Claude Code", url: "https://lobehub.com/mcp/hifriendbot-cogmemai-mcp", snippet: "Cognitive Memory for Claude Code — LobeHub MCP plugin" },
              { title: "Context Manager MCP Server", url: "https://www.pulsemcp.com/servers/davidteren-context-manager", snippet: "MCP server for managing context across sessions" },
              { title: "omega-memory — Persistent memory for AI coding agents", url: "https://pypi.org/project/omega-memory/", snippet: "#1 on LongMemEval benchmark. pip install omega-memory" },
              { title: "ai-cli-memory-system", url: "https://github.com/heyfinal/ai-cli-memory-system", snippet: "Contextual persistent memory system for Claude, Codex, Gemini, Aider" },
              { title: "Claude Code Session Memory", url: "https://claudefa.st/blog/guide/mechanics/session-memory", snippet: "Auto-recalls past work and writes summaries in the background" },
            ],
            raw_count: 5,
            summary: "웹 결과 5개, GitHub 저장소 0개 발견.",
            github_repos: [],
          },
          github: {
            repos: [],
            total_count: 0,
            summary: "유의미한 GitHub 저장소 0개를 선별했습니다 (전체 검색 모수 0개).",
          },
          differentiation: {
            competition_level: "moderate",
            competition_score: 55,
            existing_solutions: [
              { name: "omega-memory (PyPI)", similarity: 72, weakness: "벤치마크 1위가 실제 DX 좋다는 증거 아님. Claude Code 특화 로직 없음." },
              { name: "Context Manager MCP Server", similarity: 68, weakness: "MCP 범용 서버라 Claude Code 세션 특화 로직 없음. 반제품." },
              { name: "CogmemAi (LobeHub MCP)", similarity: 61, weakness: "LobeHub 생태계 종속. 독립 실행 불가." },
            ],
            unique_angles: [
              "Claude Code 세션 라이프사이클(훅, CLAUDE.md 자동 갱신) 내부 동작에 깊이 결합된 '클로드 전용' 설계",
              "GitHub 유사 저장소 0개 — 선점 기회 존재",
            ],
            is_exact_match_found: false,
            summary: "경쟁자들이 전부 범용 AI 메모리를 팔고 있는 동안 Claude Code 세션 특화 툴은 GitHub에 없다.",
          },
        },
      },
      {
        step: 2,
        title: "기술 실현성 및 데이터 검증",
        description: "데이터 소스 가용성 + 기술적 난이도 분석",
        status: "done",
        result: {
          overall_feasibility: "partial",
          score: 55,
          vibe_coding_difficulty: "medium",
          bottlenecks: [
            { type: "data_structure_unknown", description: "Claude Code 세션 데이터 구조 파악 및 추출", severity: "high", suggestion: "chokidar로 ~/.claude 감시 + 점진적 파싱. 비공개 포맷이면 수동 스냅샷 방식으로 우회" },
            { type: "complex_algorithm", description: "컨텍스트 요약 및 다음 세션 주입 타이밍/전략", severity: "medium", suggestion: "세션 종료 시 Claude API 자동 요약 → SQLite 저장 → 다음 세션 시스템 프롬프트 prefix 삽입" },
            { type: "api_unavailable", description: "Claude Code CLI 훅 공식 플러그인 진입점 부재", severity: "medium", suggestion: "파일 시스템 감시 + 래퍼 스크립트로 세션 이벤트 간접 감지" },
          ],
          tech_requirements: [
            { name: "@anthropic-ai/sdk", available: true, difficulty: "easy", note: "공식 SDK, API 키 발급 후 즉시 사용 가능" },
            { name: "better-sqlite3", available: true, difficulty: "easy", note: "세션 메타데이터 영속 저장, 동기 API로 단순 사용" },
            { name: "chokidar", available: true, difficulty: "easy", note: "로컬 파일 시스템 감시" },
            { name: "Claude Code 내부 세션 파일", available: false, difficulty: "hard", note: "공식 문서 없음, 파일 위치/포맷 비공개 — 역공학 또는 우회 필요" },
          ],
          key_risks: [
            "Claude Code 세션 파일 내부 구조가 비공개/암호화일 경우 자동 추출 자체가 불가능해 핵심 기능이 수동 트리거 방식으로 격하",
            "Claude API 호출 비용이 세션 요약마다 발생해 과금 위험",
          ],
          time_estimate: "6~12시간 (MVP: CLI 트리거 + 요약 저장 + 주입)",
          summary: "핵심 기술 스택은 검증됐으나 Claude Code 세션 파일 포맷 불확실성이 고위험 변수. CLI 수동 트리거로 범위 축소 시 주말 내 완성 현실적.",
          data_availability: {
            data_sources: [
              { name: "Claude API (Anthropic)", has_official_api: true, crawlable: false, evidence_url: "https://docs.anthropic.com", blocking: false, note: "공식 API 문서/포털 공개. API 키 발급으로 접근 가능." },
              { name: "Local File System / SQLite", has_official_api: false, crawlable: true, evidence_url: "https://www.npmjs.com/package/better-sqlite3", blocking: false, note: "로컬 파일 시스템은 외부 API 없이 Node.js에서 직접 접근 가능." },
            ],
            libraries: [
              { name: "@anthropic-ai/sdk", available_on_npm: true, package_name: "@anthropic-ai/sdk", note: "npm registry 확인" },
              { name: "better-sqlite3", available_on_npm: true, package_name: "better-sqlite3", note: "npm registry 확인" },
              { name: "chokidar", available_on_npm: true, package_name: "chokidar", note: "npm registry 확인" },
            ],
            has_blocking_issues: false,
          },
        },
      },
      {
        step: 3,
        title: "종합 판정",
        description: "최종 리포트 생성",
        status: "done",
        result: {
          verdict: "PIVOT",
          overall_score: 52,
          scores: { competition: 55, feasibility: 55, differentiation: 60, timing: 75 },
          one_liner: "세션 파일 포맷 비공개 리스크가 해소되지 않으면 핵심 기능 자체가 성립 불가 — 기술 검증이 아이디어 검증보다 먼저다.",
          recommendation: "먼저 Claude Code 세션 파일 구조 파악 가능 여부를 로컬에서 PoC(1~2일)로 검증하세요. 파일 접근이 막히면 CLAUDE.md 수동 갱신 + /compact 연동 방식으로 범위를 축소해 MVP를 완성하세요.",
          alternative_ideas: ["CLAUDE.md 자동생성기", "AI 세션 요약 CLI", "멀티모델 컨텍스트 싱크"],
        },
      },
    ],
  },

  "markdown-resume": {
    label: "마크다운 이력서 생성기 (RED OCEAN, low competition score 기대)",
    idea: "마크다운 기반의 이력서 생성기 웹앱",
    steps: [
      {
        step: 1,
        title: "시장 및 차별화 분석",
        description: "웹 & GitHub 탐색 완료",
        status: "done",
        result: {
          web: {
            competitors: [
              { title: "Renovamen/oh-my-cv — In-browser Markdown resume builder", url: "https://github.com/Renovamen/oh-my-cv", snippet: "An in-browser, local-first Markdown resume builder. Fork-ready." },
              { title: "resume.lol — Markdown + CSS resume", url: "https://www.resume.lol/", snippet: "Write in Markdown, style with CSS, export as PDF." },
              { title: "Markdown Resume (markdownresume.app)", url: "https://markdownresume.app/", snippet: "ATS-friendly markdown resume with customizable templates." },
              { title: "Free Online Markdown Resume Maker", url: "https://www.junian.dev/markdown-resume/", snippet: "Free online resume maker using Markdown." },
              { title: "Resumey.Pro Markdown CV Generator", url: "https://resumey.pro/markdown-cv-generator/", snippet: "Effortless Markdown CV builder — simple, fast, distraction-free." },
            ],
            raw_count: 7,
            summary: "웹 결과 7개, GitHub 저장소 0개 발견.",
            github_repos: [],
          },
          github: {
            repos: [],
            total_count: 0,
            summary: "유의미한 GitHub 저장소 0개를 선별했습니다.",
          },
          differentiation: {
            competition_level: "red_ocean",
            competition_score: 18,
            existing_solutions: [
              { name: "Renovamen/oh-my-cv", similarity: 92, weakness: "UI 투박, 템플릿 적음. 그러나 Fork하면 오늘 당장 배포 가능한 완성형." },
              { name: "resume.lol", similarity: 88, weakness: "CSS 커스터마이징 진입장벽 높음. 개발자 타겟으론 충분히 완성도 있음." },
              { name: "markdownresume.app", similarity: 85, weakness: "ATS 마케팅은 좋으나 템플릿 다양성 부족. 핵심 가치제안이 동일함." },
            ],
            unique_angles: [
              "Git 연동 이력서 버전 관리 + diff 시각화 개발자 특화 워크플로우",
              "LinkedIn·잡코리아 채용 플랫폼 양식 자동 파싱·변환 크로스 포맷 익스포터",
            ],
            is_exact_match_found: false,
            summary: "oh-my-cv 하나만 Fork해도 아이디어의 90%는 오늘 당장 배포 가능한데, 거기에 왜 시간과 돈을 쓰려는지 먼저 설명하세요.",
          },
        },
      },
      {
        step: 2,
        title: "기술 실현성 및 데이터 검증",
        description: "데이터 소스 가용성 + 기술적 난이도 분석",
        status: "done",
        result: {
          overall_feasibility: "possible",
          score: 85,
          vibe_coding_difficulty: "easy",
          bottlenecks: [
            { type: "binary_processing", description: "PDF 내보내기 — html2pdf.js 한글 폰트 렌더링 및 레이아웃 깨짐", severity: "medium", suggestion: "jsPDF margin/scale 조정 또는 브라우저 print-to-PDF 대체 제공" },
            { type: "complex_algorithm", description: "마크다운 → 이력서 레이아웃 매핑 — 섹션 구조를 CSS로 스타일링", severity: "medium", suggestion: "이력서 전용 마크다운 템플릿 미리 정의, CSS 클래스로 섹션 스타일 고정" },
          ],
          tech_requirements: [
            { name: "marked", available: true, difficulty: "easy", note: "마크다운 → HTML 변환, 즉시 사용 가능" },
            { name: "react-markdown", available: true, difficulty: "easy", note: "React 실시간 미리보기 렌더링에 적합" },
            { name: "html2pdf.js", available: true, difficulty: "medium", note: "PDF 변환 가능하나 한글/레이아웃 튜닝 필요" },
          ],
          key_risks: [
            "PDF 출력 시 한글 폰트 누락 또는 레이아웃 틀어짐으로 완성도 저하",
            "마크다운 구조 자유도가 높아 이력서 형식이 예측 불가능하게 망가질 수 있음",
          ],
          time_estimate: "4~8시간 (에디터+미리보기 2h, 스타일링 2h, PDF 튜닝 1~2h, 템플릿 1h)",
          summary: "핵심 의존 라이브러리 3종 모두 사용 가능, 외부 API·인증 없이 순수 프론트엔드로 완결. 주말 바이브코딩으로 충분히 완성 가능.",
          data_availability: {
            data_sources: [],
            libraries: [
              { name: "marked", available_on_npm: true, package_name: "marked", note: "npm registry 확인" },
              { name: "html2pdf.js", available_on_npm: true, package_name: "html2pdf.js", note: "npm registry 확인" },
              { name: "react-markdown", available_on_npm: true, package_name: "react-markdown", note: "npm registry 확인" },
            ],
            has_blocking_issues: false,
          },
        },
      },
      {
        step: 3,
        title: "종합 판정",
        description: "최종 리포트 생성",
        status: "done",
        result: {
          verdict: "PIVOT",
          overall_score: 45,
          scores: { competition: 18, feasibility: 85, differentiation: 30, timing: 35 },
          one_liner: "기술 장벽은 낮지만 red_ocean에서 차별화 없이 진입하면 oh-my-cv의 카피캣으로 끝난다.",
          recommendation: "'Git 연동 diff 시각화' 또는 '채용 플랫폼 자동 파싱 익스포터' 중 하나를 킬러 기능으로 MVP에 반드시 포함하거나, oh-my-cv를 Fork해서 시작하세요.",
          alternative_ideas: ["개발자 포트폴리오 빌더", "채용공고 맞춤 자소서 AI", "링크드인 프로필 최적화"],
        },
      },
    ],
  },

  "fork-case": {
    label: "FORK 판정 케이스 (95% 일치 OSS 발견)",
    idea: "React + TypeScript 프로젝트 보일러플레이트 생성기",
    steps: [
      {
        step: 1,
        title: "시장 및 차별화 분석",
        description: "웹 & GitHub 탐색 완료",
        status: "done",
        result: {
          web: {
            competitors: [
              { title: "Create React App", url: "https://create-react-app.dev", snippet: "Set up a modern web app by running one command." },
              { title: "Vite — Next Generation Frontend Tooling", url: "https://vitejs.dev", snippet: "Scaffolding your first Vite project." },
            ],
            raw_count: 8,
            summary: "웹 결과 8개, GitHub 저장소 3개 발견.",
            github_repos: [
              { name: "vitejs/vite", description: "Next generation frontend tooling", stars: 70000, url: "https://github.com/vitejs/vite", language: "TypeScript", updated: "2026-02-19" },
            ],
          },
          github: {
            repos: [
              { name: "vitejs/vite", description: "Next generation frontend tooling. It's fast!", stars: 70000, url: "https://github.com/vitejs/vite", language: "TypeScript", updated: "2026-02-19" },
              { name: "total-typescript/ts-reset", description: "A 'CSS reset' for TypeScript, improving types for common JavaScript API's", stars: 8200, url: "https://github.com/total-typescript/ts-reset", language: "TypeScript", updated: "2026-01-10" },
              { name: "jpedroschmitz/typescript-nextjs-starter", description: "Next.js + TypeScript starter with ESLint, Prettier, Husky, Lint-staged, Jest and Cypress", stars: 3100, url: "https://github.com/jpedroschmitz/typescript-nextjs-starter", language: "TypeScript", updated: "2025-11-20" },
            ],
            total_count: 12400,
            summary: "유의미한 GitHub 저장소 3개를 선별했습니다 (전체 검색 모수 12400개).",
          },
          differentiation: {
            competition_level: "red_ocean",
            competition_score: 8,
            existing_solutions: [
              { name: "Vite (vitejs/vite)", similarity: 97, weakness: "사실상 당신 아이디어 그 자체. 70k stars. Fork해서 쓰면 됨." },
              { name: "create-react-app", similarity: 95, weakness: "Meta가 만든 공식 보일러플레이트. 이미 deprecate됐지만 대체재(Vite)가 더 낫다." },
            ],
            unique_angles: [],
            is_exact_match_found: true,
            summary: "Vite가 이미 이 아이디어를 95% 이상 커버한다. 바닥부터 만들 이유가 없다.",
          },
        },
      },
      {
        step: 2,
        title: "기술 실현성 및 데이터 검증",
        description: "데이터 소스 가용성 + 기술적 난이도 분석",
        status: "done",
        result: {
          overall_feasibility: "possible",
          score: 80,
          vibe_coding_difficulty: "easy",
          bottlenecks: [
            { type: "existing_open_source", description: "Vite가 이미 동일 기능을 제공하는 검증된 OSS", severity: "medium", suggestion: "Vite를 fork하거나 커스텀 템플릿으로 wrapping하는 방향으로 전환" },
          ],
          tech_requirements: [
            { name: "Node.js fs/path", available: true, difficulty: "easy", note: "파일 시스템 조작, 추가 설치 불필요" },
            { name: "inquirer / prompts", available: true, difficulty: "easy", note: "CLI 인터랙티브 인터페이스" },
          ],
          key_risks: ["Vite/CRA 대비 차별화 포인트 없으면 아무도 쓰지 않음"],
          time_estimate: "4~6시간",
          summary: "기술적으로는 쉽지만 Vite가 이미 존재하므로 만들 필요가 없음",
          data_availability: { data_sources: [], libraries: [], has_blocking_issues: false },
        },
      },
      {
        step: 3,
        title: "종합 판정",
        description: "최종 리포트 생성",
        status: "done",
        result: {
          verdict: "FORK",
          overall_score: 30,
          scores: { competition: 8, feasibility: 80, differentiation: 5, timing: 20 },
          one_liner: "Vite가 이미 95% 이상 커버한다. 바닥부터 만들지 말고 Vite 템플릿을 fork해서 시작하세요.",
          recommendation: "vitejs/vite를 fork하거나 `npm create vite@latest`에 커스텀 템플릿을 추가하는 방식으로 접근하세요. 처음부터 만드는 것은 시간 낭비입니다.",
          alternative_ideas: ["Vite 커스텀 템플릿", "팀 전용 스타터킷", "모노레포 보일러플레이트"],
        },
      },
    ],
  },

  "kill-case": {
    label: "KILL 판정 케이스 (blocking 이슈 + 낮은 점수)",
    idea: "카카오톡 채팅 분석기 — 대화 패턴 AI 분석 웹앱",
    steps: [
      {
        step: 1,
        title: "시장 및 차별화 분석",
        description: "웹 & GitHub 탐색 완료",
        status: "done",
        result: {
          web: {
            competitors: [
              { title: "KakaoTalk Stats — 카카오톡 통계", url: "https://kakaostats.com", snippet: "카카오톡 대화 내용을 분석해 통계를 제공하는 서비스" },
              { title: "채팅 분석기 — Chat Analyzer", url: "https://chat-analyzer.kr", snippet: "카카오톡/라인 채팅 파일을 업로드해 분석" },
            ],
            raw_count: 4,
            summary: "웹 결과 4개, GitHub 저장소 1개 발견.",
            github_repos: [],
          },
          github: {
            repos: [
              { name: "kakao-chat-analyzer/kakao-chat-analyzer", description: "카카오톡 채팅 분석 오픈소스", stars: 320, url: "https://github.com/kakao-chat-analyzer", language: "Python", updated: "2024-08-10" },
            ],
            total_count: 34,
            summary: "유의미한 GitHub 저장소 1개를 선별했습니다.",
          },
          differentiation: {
            competition_level: "moderate",
            competition_score: 48,
            existing_solutions: [
              { name: "KakaoTalk Stats", similarity: 78, weakness: "기본 통계만 제공, AI 분석 없음" },
              { name: "kakao-chat-analyzer (GitHub)", similarity: 65, weakness: "Python CLI, 웹앱 아님" },
            ],
            unique_angles: ["GPT 기반 대화 감정/패턴 AI 분석", "관계 지수 시각화"],
            is_exact_match_found: false,
            summary: "유사 서비스는 있지만 AI 분석 각도로 차별화 여지 있음. 핵심 문제는 데이터 접근권.",
          },
        },
      },
      {
        step: 2,
        title: "기술 실현성 및 데이터 검증",
        description: "데이터 소스 가용성 + 기술적 난이도 분석",
        status: "done",
        result: {
          overall_feasibility: "difficult",
          score: 28,
          vibe_coding_difficulty: "hard",
          bottlenecks: [
            { type: "api_unavailable", description: "카카오톡 공식 채팅 API 없음 — 대화 내용 추출 불가", severity: "high", suggestion: "txt 파일 수동 내보내기를 입력으로 받는 방식으로 우회. 단, UX 심각하게 저하됨." },
            { type: "auth_complexity", description: "개인정보(채팅 내용) 서버 업로드 시 법적 리스크", severity: "high", suggestion: "완전 클라이언트 사이드 처리로 서버 미전송. 하지만 AI API 호출 불가 딜레마." },
          ],
          tech_requirements: [
            { name: "카카오 공식 채팅 API", available: false, difficulty: "hard", note: "공식 API 없음. 채팅 내보내기 txt만 접근 가능." },
            { name: "OpenAI / Claude API", available: true, difficulty: "easy", note: "AI 분석 자체는 가능하나 채팅 데이터 전송 개인정보 이슈." },
          ],
          key_risks: [
            "카카오톡 공식 API 없어 txt 내보내기만 의존 — 핵심 UX 치명적",
            "채팅 내용 서버 전송 시 개인정보보호법 위반 리스크",
            "카카오 txt 파일 포맷 변경 시 파서 전면 수정 필요",
          ],
          time_estimate: "8~20시간 (파서 구현이 핵심 리스크)",
          summary: "카카오 공식 API 없고 개인정보 이슈까지 겹쳐 핵심 기능 구현 자체가 법적·기술적 지뢰밭",
          data_availability: {
            data_sources: [
              { name: "KakaoTalk Chat API", has_official_api: false, crawlable: false, blocking: true, note: "공식 API 없음. txt 파일 내보내기만 가능. 자동 수집 불가." },
            ],
            libraries: [
              { name: "openai", available_on_npm: true, package_name: "openai", note: "npm registry 확인" },
            ],
            has_blocking_issues: true,
          },
        },
      },
      {
        step: 3,
        title: "종합 판정",
        description: "최종 리포트 생성",
        status: "done",
        result: {
          verdict: "KILL",
          overall_score: 22,
          scores: { competition: 48, feasibility: 28, differentiation: 40, timing: 30 },
          one_liner: "카카오 공식 API 없음 + 개인정보 이슈 = 핵심 기능이 법적·기술적 지뢰밭 위에 서 있다.",
          recommendation: "카카오가 공식 API를 열기 전까지 이 아이디어는 실현 불가입니다. txt 파일 기반 로컬 처리로 범위를 극단적으로 줄이거나, Slack/Discord 등 공식 API가 있는 채팅 플랫폼으로 타겟을 전환하세요.",
          alternative_ideas: ["Slack 대화 분석기", "Discord 서버 인사이트", "GitHub PR 커뮤니케이션 분석"],
        },
      },
    ],
  },
};

// ── Component ──────────────────────────────────────────────────

export default function TestPage() {
  const [selected, setSelected] = useState<string>("claude-session");
  const scenario = MOCK_SCENARIOS[selected];

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-6">
        <Header />

        {/* Scenario selector */}
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-600">
            🧪 Mock Test Page — 실제 API 호출 없음
          </p>
          <div className="flex flex-col gap-2">
            {Object.entries(MOCK_SCENARIOS).map(([key, s]) => (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={`rounded-xl border px-4 py-2.5 text-left text-sm transition-all ${
                  selected === key
                    ? "border-amber-400 bg-amber-100 font-semibold text-amber-800"
                    : "border-amber-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Idea header */}
        <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">검증 아이디어</p>
          <p className="text-lg font-bold text-slate-800">&ldquo;{scenario.idea}&rdquo;</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-go/20 px-2.5 py-1 text-xs font-semibold text-go">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-go" />
              검증 완료
            </span>
            <span className="text-xs text-slate-400">3 / 3 단계</span>
          </div>
        </div>

        {/* Step cards */}
        <div className="space-y-4">
          {scenario.steps.map((step) => (
            <StepCard key={step.step} step={step} idea={scenario.idea} />
          ))}
          <ChatPanel analysisResults={scenario.steps} idea={scenario.idea} />
        </div>
      </div>
    </div>
  );
}
