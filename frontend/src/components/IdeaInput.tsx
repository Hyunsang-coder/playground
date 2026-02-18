import { useState } from "react";
import { Search, Zap, Coffee } from "lucide-react";

interface Props {
  onSubmit: (idea: string, mode: string) => void;
  isLoading: boolean;
}

const MODES = [
  { value: "hackathon", label: "해커톤", icon: Zap, desc: "5시간 이내, 1인 바이브코딩" },
  { value: "sideproject", label: "사이드", icon: Coffee, desc: "주말 개발, 배포까지" },
];

const EXAMPLES = [
  "AI 기반 뉴스 팩트체커",
  "Claude Code 세션 간 컨텍스트 자동 유지 도구",
  "해커톤 아이디어 검증기",
  "AI 코드 리뷰 자동화 도구",
];

export default function IdeaInput({ onSubmit, isLoading }: Props) {
  const [idea, setIdea] = useState("");
  const [mode, setMode] = useState("hackathon");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim() || isLoading) return;
    onSubmit(idea.trim(), mode);
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl space-y-6">
      {/* Idea input */}
      <div className="relative">
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="아이디어를 한 줄로 입력하세요..."
          rows={2}
          className="w-full resize-none rounded-2xl border border-gray-700 bg-gray-900 px-4 sm:px-6 py-4 text-lg sm:text-xl text-gray-100 placeholder-gray-500 outline-none transition-colors focus:border-kill/50 focus:ring-2 focus:ring-kill/20"
          disabled={isLoading}
        />
      </div>

      {/* Example ideas */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-gray-500">예시:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setIdea(ex)}
            className="rounded-full border border-gray-700 px-3 py-1 text-sm text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {MODES.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={`flex items-center gap-1.5 sm:gap-2 rounded-xl border px-2.5 sm:px-4 py-3 text-sm transition-all ${
                mode === m.value
                  ? "border-kill/50 bg-kill/10 text-kill"
                  : "border-gray-700 text-gray-400 hover:border-gray-500"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="text-left min-w-0">
                <div className="font-semibold truncate">{m.label}</div>
                <div className="text-xs opacity-70 truncate hidden sm:block">{m.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={!idea.trim() || isLoading}
        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-kill px-6 sm:px-8 py-3.5 sm:py-4 text-lg sm:text-xl font-bold text-white transition-all hover:bg-red-600 disabled:opacity-40 disabled:hover:bg-kill"
      >
        <Search className="h-6 w-6" />
        {isLoading ? "분석 중..." : "이 아이디어를 죽여줘"}
      </button>
    </form>
  );
}
