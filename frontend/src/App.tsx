import { RotateCcw } from "lucide-react";
import Header from "./components/Header";
import IdeaInput from "./components/IdeaInput";
import StepCard from "./components/StepCard";
import { useAnalysis } from "./useAnalysis";

export default function App() {
  const { steps, isAnalyzing, error, analyze, reset } = useAnalysis();

  const hasResults = steps.length > 0;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 pb-20">
        <Header />

        {/* Input section */}
        {!hasResults && <IdeaInput onSubmit={analyze} isLoading={isAnalyzing} />}

        {/* Error */}
        {error && (
          <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-kill/30 bg-kill/10 p-4 text-center text-kill">
            {error}
          </div>
        )}

        {/* Analysis steps */}
        {hasResults && (
          <div className="mt-8 space-y-4">
            {/* Reset button */}
            <div className="flex justify-end">
              <button
                onClick={reset}
                disabled={isAnalyzing}
                className="flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200 disabled:opacity-40"
              >
                <RotateCcw className="h-4 w-4" />
                새 아이디어 검증
              </button>
            </div>

            {/* Step cards */}
            {steps.map((step) => (
              <StepCard key={step.step} step={step} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
