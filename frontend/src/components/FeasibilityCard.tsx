import { CheckCircle2, XCircle, AlertTriangle, ShieldAlert } from "lucide-react";
import type { FeasibilityResult } from "../types";

interface Props {
  data: FeasibilityResult;
}

const FEASIBILITY_CONFIG = {
  possible: { label: "구현 가능", color: "text-go", bg: "bg-go/10" },
  partial: { label: "부분 가능", color: "text-pivot", bg: "bg-pivot/10" },
  difficult: { label: "구현 어려움", color: "text-kill", bg: "bg-kill/10" },
};

const DIFFICULTY_COLORS = {
  easy: "text-go",
  medium: "text-pivot",
  hard: "text-kill",
};

export default function FeasibilityCard({ data }: Props) {
  const config = FEASIBILITY_CONFIG[data.overall_feasibility] || FEASIBILITY_CONFIG.partial;

  return (
    <div className="space-y-4">
      {/* Score & summary */}
      <div className="flex items-center gap-4">
        <div className={`text-5xl font-black ${config.color}`}>{data.score}</div>
        <div>
          <div className={`inline-block rounded-lg px-3 py-1 text-sm font-bold ${config.bg} ${config.color}`}>
            {config.label}
          </div>
          <div className="mt-1 text-sm text-gray-400">{data.summary}</div>
        </div>
      </div>

      {/* Tech requirements */}
      {data.tech_requirements.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-300">필요 기술</h4>
          {data.tech_requirements.map((t, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-800 p-3">
              {t.available ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-go" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 text-kill" />
              )}
              <div className="flex-1">
                <span className="font-medium">{t.name}</span>
                <span className="ml-2 text-sm text-gray-500">{t.note}</span>
              </div>
              <span className={`text-xs font-mono ${DIFFICULTY_COLORS[t.difficulty] || "text-gray-400"}`}>
                {t.difficulty}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Data source risks */}
      {data.data_source_risks?.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-kill">
            <ShieldAlert className="h-4 w-4" /> 데이터 소스 리스크
          </h4>
          {data.data_source_risks.map((risk, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-kill/20 bg-kill/5 p-3 text-sm">
              <span className="text-kill">🚫</span>
              <span className="text-gray-300">{risk}</span>
            </div>
          ))}
        </div>
      )}

      {/* Risks */}
      {data.key_risks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-300">핵심 리스크</h4>
          {data.key_risks.map((risk, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-pivot" />
              <span className="text-gray-400">{risk}</span>
            </div>
          ))}
        </div>
      )}

      {/* Time estimate */}
      {data.time_estimate && (
        <div className="text-sm text-gray-500">
          예상 개발 시간: <span className="font-medium text-gray-300">{data.time_estimate}</span>
        </div>
      )}
    </div>
  );
}
