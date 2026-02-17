import { CheckCircle2, Loader2, Circle, Globe, Github, Brain, Swords, Gavel } from "lucide-react";
import type { AnalysisStep } from "../types";
import CompetitorList from "./CompetitorList";
import GitHubList from "./GitHubList";
import FeasibilityCard from "./FeasibilityCard";
import DifferentiationCard from "./DifferentiationCard";
import VerdictCard from "./VerdictCard";

interface Props {
  step: AnalysisStep;
  idea?: string;
  onReanalyze?: (idea: string) => void;
}

function StepIcon({ stepNum, className }: { stepNum: number; className: string }) {
  switch (stepNum) {
    case 1: return <Globe className={className} />;
    case 2: return <Github className={className} />;
    case 3: return <Brain className={className} />;
    case 4: return <Swords className={className} />;
    case 5: return <Gavel className={className} />;
    default: return <Circle className={className} />;
  }
}

function StatusBadge({ status }: { status: string }) {
  if (status === "done") return <CheckCircle2 className="h-5 w-5 text-go" />;
  if (status === "loading") return <Loader2 className="h-5 w-5 text-pivot animate-spin" />;
  return <Circle className="h-5 w-5 text-gray-600" />;
}

export default function StepCard({ step, idea, onReanalyze }: Props) {
  return (
    <div className="step-card animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            step.status === "done"
              ? "bg-go/20 text-go"
              : step.status === "loading"
                ? "bg-pivot/20 text-pivot"
                : "bg-gray-800 text-gray-500"
          }`}
        >
          <StepIcon stepNum={step.step} className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg">{step.title}</h3>
            <StatusBadge status={step.status} />
          </div>
          <p className="text-sm text-gray-400">{step.description}</p>
        </div>
        <span className="text-sm font-mono text-gray-500">
          Step {step.step}/5
        </span>
      </div>

      {/* Result content */}
      {step.status === "done" && step.result != null ? (
        <div className="mt-4 animate-fade-in">
          {step.step === 1 && <CompetitorList data={step.result as any} />}
          {step.step === 2 && <GitHubList data={step.result as any} />}
          {step.step === 3 && <FeasibilityCard data={step.result as any} />}
          {step.step === 4 && <DifferentiationCard data={step.result as any} />}
          {step.step === 5 && <VerdictCard data={step.result as any} idea={idea} onReanalyze={onReanalyze} />}
        </div>
      ) : null}

      {/* Loading skeleton */}
      {step.status === "loading" && (
        <div className="mt-4 space-y-3">
          {step.progressText && (
            <div className="text-sm text-pivot animate-pulse">{step.progressText}</div>
          )}
          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-800" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-gray-800" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-gray-800" />
        </div>
      )}
    </div>
  );
}
