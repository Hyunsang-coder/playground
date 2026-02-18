"use client";

import { useState } from "react";
import { RotateCcw, Zap, Coffee } from "lucide-react";
import Header from "./components/Header";
import IdeaInput from "./components/IdeaInput";
import StepCard from "./components/StepCard";
import ChatPanel from "./components/ChatPanel";
import { useAnalysis } from "./useAnalysis";

const MODE_LABELS: Record<string, { label: string; icon: typeof Zap }> = {
  hackathon: { label: "해커톤", icon: Zap },
  sideproject: { label: "사이드 프로젝트", icon: Coffee },
};

const TOTAL_STEPS = 5;

export default function Page() {
  const { steps, isAnalyzing, error, analyze, reset } = useAnalysis();
  const [currentIdea, setCurrentIdea] = useState("");
  const [currentMode, setCurrentMode] = useState("");

  const hasResults = steps.length > 0;
  const completedSteps = steps.filter((s) => s.status === "done").length;
  const progress = (completedSteps / TOTAL_STEPS) * 100;

  const handleAnalyze = (idea: string, mode: string) => {
    setCurrentIdea(idea);
    setCurrentMode(mode);
    analyze(idea, mode);
  };

  const handleReset = () => {
    setCurrentIdea("");
    setCurrentMode("");
    reset();
  };

  const modeInfo = MODE_LABELS[currentMode];

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
                onClick={() => handleAnalyze(currentIdea, currentMode || "hackathon")}
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
                  {modeInfo && (
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                      <modeInfo.icon className="h-3.5 w-3.5" />
                      <span>{modeInfo.label} 모드</span>
                    </div>
                  )}
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
                  <span className="font-mono">{completedSteps} / {TOTAL_STEPS}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      completedSteps === TOTAL_STEPS ? "bg-go" : "bg-brand"
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
                  handleReset();
                  setTimeout(() => handleAnalyze(newIdea, currentMode || "hackathon"), 100);
                }}
              />
            ))}

            {/* Chat panel — shown when all 5 steps are done */}
            {completedSteps === TOTAL_STEPS && (
              <ChatPanel analysisResults={steps} idea={currentIdea} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
