"use client";

import { useState } from "react";
import { Loader2, RotateCcw, Download, FileText, FileJson } from "lucide-react";
import Header from "./components/Header";
import IdeaInput from "./components/IdeaInput";
import StepCard from "./components/StepCard";
import ChatPanel from "./components/ChatPanel";
import { useAnalysis } from "./useAnalysis";
import { exportAsMarkdown, exportAsJson, downloadFile } from "./exportUtils";

export default function Page() {
  const { steps, isAnalyzing, error, analyze, reset } = useAnalysis();
  const [currentIdea, setCurrentIdea] = useState("");
  const [enabledSteps, setEnabledSteps] = useState<number[]>([1, 2, 3]);

  const [showExportMenu, setShowExportMenu] = useState(false);

  const hasResults = steps.length > 0 || isAnalyzing;
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
    setEnabledSteps([1, 2, 3]);
    reset();
  };

  const handleExport = (format: "md" | "json") => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const slug = currentIdea.slice(0, 20).replace(/\s+/g, "_");
    if (format === "md") {
      const content = exportAsMarkdown(currentIdea, steps);
      downloadFile(content, `valid8_${slug}_${timestamp}.md`, "text/markdown;charset=utf-8");
    } else {
      const content = exportAsJson(currentIdea, steps);
      downloadFile(content, `valid8_${slug}_${timestamp}.json`, "application/json;charset=utf-8");
    }
    setShowExportMenu(false);
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 pb-20">
        <div className={`transition-all duration-700 ease-in-out ${hasResults ? "pt-4 sm:pt-6" : "pt-[15vh] sm:pt-[20vh]"}`}>
          <Header />
          <div className={`transition-all duration-700 ease-in-out origin-top ${hasResults ? "scale-[0.95] opacity-80 pb-6" : "scale-100 opacity-100 pb-12"}`}>
            <IdeaInput onSubmit={handleAnalyze} isLoading={isAnalyzing} />
          </div>
        </div>

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
            <div className={`rounded-2xl border transition-all duration-500 overflow-hidden relative ${isAnalyzing
              ? "border-brand/30 bg-white/80 shadow-lg shadow-brand/10 ring-4 ring-brand/5"
              : "border-slate-200/80 bg-white shadow-sm"
              }`}>
              {/* Optional: subtile background pulse when analyzing */}
              {isAnalyzing && (
                <div className="absolute inset-0 bg-gradient-to-r from-brand/5 via-transparent to-brand/5 animate-pulse opacity-50 pointer-events-none" />
              )}

              <div className="relative p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-1">
                      <p className="text-lg font-bold text-slate-800 leading-snug">
                        &ldquo;{currentIdea}&rdquo;
                      </p>
                      {isAnalyzing && (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand/5 border border-brand/20 px-2.5 py-1 text-xs font-semibold text-brand shadow-sm">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
                          </span>
                          분석 진행 중
                        </span>
                      )}
                      {allDone && (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 border border-go/20 px-2.5 py-1 text-xs font-semibold text-go shadow-sm">
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-go"></span>
                          검증 완료
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {allDone && (
                      <div className="relative">
                        <button
                          onClick={() => setShowExportMenu((v) => !v)}
                          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          내보내기
                        </button>
                        {showExportMenu && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                            <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                              <button
                                onClick={() => handleExport("md")}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-50"
                              >
                                <FileText className="h-4 w-4 text-slate-400" />
                                Markdown (.md)
                              </button>
                              <button
                                onClick={() => handleExport("json")}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-50"
                              >
                                <FileJson className="h-4 w-4 text-slate-400" />
                                JSON (.json)
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    <button
                      onClick={handleReset}
                      disabled={isAnalyzing}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      새 검증
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative px-5 pb-5">
                <div className="flex items-center justify-between text-sm font-medium mb-2">
                  <span className={isAnalyzing ? "text-brand" : "text-slate-500"}>
                    {isAnalyzing ? "AI가 다각도로 분석하고 있습니다..." : "진행률"}
                  </span>
                  <span className="font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {completedSteps} / {enabledSteps.length} 단계
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden relative shadow-inner">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${allDone ? "bg-go" : "bg-brand"
                      }`}
                    style={{ width: `${progress}%` }}
                  >
                    {isAnalyzing && (
                      <div className="absolute inset-0 w-full h-full progress-shimmer" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Step cards */}
            {isAnalyzing && steps.length === 0 && (
              <div className="step-card animate-slide-up">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/8 text-brand">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">분석 준비 중</h3>
                    <p className="text-sm text-slate-500">AI가 검색 전략을 준비하고 있습니다...</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-4 w-3/4 rounded shimmer-skeleton" />
                  <div className="h-4 w-2/3 rounded shimmer-skeleton" />
                  <div className="h-4 w-1/2 rounded shimmer-skeleton" />
                </div>
              </div>
            )}

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
