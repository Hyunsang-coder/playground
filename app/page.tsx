"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import Header from "./components/Header";
import IdeaInput from "./components/IdeaInput";
import StepCard from "./components/StepCard";
import ChatPanel from "./components/ChatPanel";
import { useAnalysis } from "./useAnalysis";

export default function Page() {
  const { steps, isAnalyzing, error, analyze, reset } = useAnalysis();
  const [currentIdea, setCurrentIdea] = useState("");
  const [enabledSteps, setEnabledSteps] = useState<number[]>([1, 2, 3, 4, 5]);

  const hasResults = steps.length > 0;
  const completedSteps = steps.filter((s) => s.status === "done").length;
  const progress = enabledSteps.length > 0 ? (completedSteps / enabledSteps.length) * 100 : 0;
  const allDone = completedSteps === enabledSteps.length && enabledSteps.length > 0;

  const handleAnalyze = (idea: string, stepsToRun: number[]) => {
    setEnabledSteps(stepsToRun);
    setCurrentIdea(idea);
    analyze(idea, stepsToRun);
  };

  const handleReset = () => {
    setCurrentIdea("");
    setEnabledSteps([1, 2, 3, 4, 5]);
    reset();
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 pb-20">
        <Header />

        {/* Input section */}
        {!hasResults && <IdeaInput onSubmit={handleAnalyze} isLoading={isAnalyzing} />}

        {/* Error */}
        {error && (
          <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
            <p className="text-rose-600 font-medium">{error}</p>
            {currentIdea && (
              <button
                onClick={() => handleAnalyze(currentIdea, enabledSteps)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                다시 시도
              </button>
            )}
          </div>
        )}

        {/* Analysis steps */}
        {hasResults && (
          <div className="mt-8 space-y-4">
            {/* Idea summary + progress */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-slate-800 leading-snug">
                    &ldquo;{currentIdea}&rdquo;
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  disabled={isAnalyzing}
                  className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  새 검증
                </button>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span>분석 진행률</span>
                  <span className="font-mono">{completedSteps} / {enabledSteps.length}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      allDone ? "bg-go" : "bg-brand"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Step cards */}
            {steps.map((step) => (
              <StepCard
                key={step.step}
                step={step}
                idea={currentIdea}
                onReanalyze={(newIdea) => {
                  const stepsToRun = enabledSteps;
                  handleReset();
                  setTimeout(() => handleAnalyze(newIdea, stepsToRun), 100);
                }}
              />
            ))}

            {/* Chat panel — shown when all enabled steps are done */}
            {allDone && (
              <ChatPanel analysisResults={steps} idea={currentIdea} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
