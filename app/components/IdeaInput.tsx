"use client";

import { useState } from "react";
import { Search, CheckSquare, Square } from "lucide-react";

interface Props {
  onSubmit: (idea: string, enabledSteps: number[]) => void;
  isLoading: boolean;
}

const STEPS = [
  { step: 1, label: "경쟁 제품 탐색" },
  { step: 2, label: "GitHub 유사 프로젝트" },
  { step: 3, label: "바이브코딩 실현성" },
  { step: 4, label: "차별화 분석" },
  { step: 5, label: "종합 판정" },
];

const EXAMPLES = [
  "AI 기반 뉴스 팩트체커",
  "Claude Code 세션 간 컨텍스트 자동 유지 도구",
  "해커톤 아이디어 검증기",
  "AI 코드 리뷰 자동화 도구",
];

export default function IdeaInput({ onSubmit, isLoading }: Props) {
  const [idea, setIdea] = useState("");
  const [enabledSteps, setEnabledSteps] = useState<number[]>([1, 2, 3, 4, 5]);

  const toggleStep = (step: number) => {
    setEnabledSteps((prev) =>
      prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step].sort((a, b) => a - b)
    );
  };

  const allSelected = enabledSteps.length === STEPS.length;
  const toggleAll = () => setEnabledSteps(allSelected ? [] : [1, 2, 3, 4, 5]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim() || isLoading || enabledSteps.length === 0) return;
    onSubmit(idea.trim(), enabledSteps);
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

      {/* Step selector */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">분석 단계 선택</p>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs font-medium text-brand hover:underline"
          >
            {allSelected ? "전체 해제" : "전체 선택"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STEPS.map((item) => {
            const checked = enabledSteps.includes(item.step);
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => toggleStep(item.step)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                  checked
                    ? "border-brand/40 bg-brand/5 text-brand"
                    : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {checked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                <span>
                  {item.step}. {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {enabledSteps.length === 0 && (
          <p className="mt-3 text-xs text-rose-600">최소 1개 이상의 단계를 선택해야 합니다.</p>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={!idea.trim() || isLoading || enabledSteps.length === 0}
        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-brand px-6 sm:px-8 py-3.5 sm:py-4 text-lg sm:text-xl font-bold text-white shadow-lg shadow-brand/20 transition-all hover:bg-indigo-600 hover:shadow-xl hover:shadow-brand/25 disabled:opacity-40 disabled:shadow-none disabled:hover:bg-brand"
      >
        <Search className="h-6 w-6" />
        {isLoading ? "분석 중..." : "이 아이디어를 검증하기"}
      </button>
    </form>
  );
}
