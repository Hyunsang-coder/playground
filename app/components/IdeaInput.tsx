"use client";

import { useState } from "react";
import { Search, CheckSquare, Square } from "lucide-react";

interface Props {
  onSubmit: (idea: string, enabledSteps: number[]) => void;
  isLoading: boolean;
}

interface Props {
  onSubmit: (idea: string, enabledSteps: number[]) => void;
  isLoading: boolean;
}

const EXAMPLES = [
  "마크다운 기반의 이력서 생성기 웹앱",
  "GitHub PR을 자동으로 리뷰해주는 봇",
  "우주 쓰레기 궤도 통합 분석 시뮬레이터",
  "Claude Code 세션 간 컨텍스트 자동 유지 도구",
];

export default function IdeaInput({ onSubmit, isLoading }: Props) {
  const [idea, setIdea] = useState("");

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!idea.trim() || isLoading) return;
    onSubmit(idea.trim(), [1, 2, 3]); // Always run all steps for One-Click UX
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl space-y-6">
      {/* Idea input */}
      <div className="relative">
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="아이디어를 입력하세요... (Enter로 바로 검증)"
          rows={3}
          className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 sm:px-6 py-4 text-lg sm:text-xl text-slate-800 placeholder-slate-400 shadow-sm outline-none transition-all focus:border-brand/50 focus:ring-2 focus:ring-brand/10 focus:shadow-md"
          disabled={isLoading}
        />
      </div>

      {/* Example ideas */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-slate-400">예시:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setIdea(ex)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-500 shadow-sm transition-all hover:border-brand/30 hover:text-brand hover:shadow"
          >
            {ex}
          </button>
        ))}
      </div>



      {/* Submit button */}
      <button
        type="submit"
        disabled={!idea.trim() || isLoading}
        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-brand px-6 sm:px-8 py-3.5 sm:py-4 text-lg sm:text-xl font-bold text-white shadow-lg shadow-brand/20 transition-all hover:bg-indigo-600 hover:shadow-xl hover:shadow-brand/25 disabled:opacity-40 disabled:shadow-none disabled:hover:bg-brand"
      >
        <Search className="h-6 w-6" />
        {isLoading ? "분석 중..." : "바이브코딩(AI)으로 당장 구현 가능한가요?"}
      </button>
    </form>
  );
}
