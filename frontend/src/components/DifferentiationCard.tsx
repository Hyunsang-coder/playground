import { Swords, Lightbulb, AlertOctagon, Target } from "lucide-react";
import type { DifferentiationResult } from "../types";

interface Props {
  data: DifferentiationResult;
}

const LEVEL_CONFIG = {
  blue_ocean: { label: "블루오션", color: "text-go", emoji: "🌊" },
  moderate: { label: "보통 경쟁", color: "text-pivot", emoji: "⚔️" },
  red_ocean: { label: "레드오션", color: "text-kill", emoji: "🔴" },
};

export default function DifferentiationCard({ data }: Props) {
  const config = LEVEL_CONFIG[data.competition_level] || LEVEL_CONFIG.moderate;

  return (
    <div className="space-y-4">
      {/* Competition level */}
      <div className="flex items-center gap-4">
        <div className={`text-5xl font-black ${config.color}`}>{data.competition_score}</div>
        <div>
          <div className={`text-lg font-bold ${config.color}`}>
            {config.emoji} {config.label}
          </div>
          <div className="text-sm text-gray-400">{data.summary}</div>
        </div>
      </div>

      {/* Market gap */}
      {data.market_gap && (
        <div className="rounded-xl border border-go/20 bg-go/5 p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-go">
            <Target className="h-4 w-4" /> 시장 틈새
          </h4>
          <p className="mt-1 text-sm text-gray-300">{data.market_gap}</p>
        </div>
      )}

      {/* Existing solutions */}
      {data.existing_solutions.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-300">
            <Swords className="h-4 w-4" /> 기존 솔루션
          </h4>
          {data.existing_solutions.map((s, i) => (
            <div key={i} className="rounded-lg border border-gray-800 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  {s.is_active !== undefined && (
                    <span className={`rounded px-1.5 py-0.5 text-xs ${s.is_active ? "bg-go/10 text-go" : "bg-gray-800 text-gray-500"}`}>
                      {s.is_active ? "활성" : "비활성"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">유사도</span>
                  <span className={`font-mono font-bold ${s.similarity > 70 ? "text-kill" : s.similarity > 40 ? "text-pivot" : "text-go"}`}>
                    {s.similarity}%
                  </span>
                </div>
              </div>
              <div className="mt-1 text-sm text-gray-500">— {s.weakness}</div>
              {s.overlap_features && s.overlap_features.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {s.overlap_features.map((f, j) => (
                    <span key={j} className="rounded-full bg-kill/10 px-2 py-0.5 text-xs text-kill/70">
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Devil's arguments */}
      {data.devil_arguments.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-kill">
            <AlertOctagon className="h-4 w-4" /> 이 아이디어가 실패하는 이유
          </h4>
          {data.devil_arguments.map((arg, i) => (
            <div key={i} className="rounded-lg border border-kill/20 bg-kill/5 p-3 text-sm text-gray-300">
              {i + 1}. {arg}
            </div>
          ))}
        </div>
      )}

      {/* Unique angles */}
      {data.unique_angles.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-go">
            <Lightbulb className="h-4 w-4" /> 차별화 가능 포인트
          </h4>
          {data.unique_angles.map((angle, i) => (
            <div key={i} className="rounded-lg border border-go/20 bg-go/5 p-3 text-sm text-gray-300">
              {angle}
            </div>
          ))}
        </div>
      )}

      {/* Pivot suggestions */}
      {data.pivot_suggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-300">피벗 제안</h4>
          <div className="flex flex-wrap gap-2">
            {data.pivot_suggestions.map((s, i) => (
              <span key={i} className="rounded-full border border-pivot/30 bg-pivot/10 px-3 py-1 text-sm text-pivot">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
