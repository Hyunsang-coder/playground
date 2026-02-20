"use client";

import { Swords, Lightbulb, Waves, Flame } from "lucide-react";
import type { DifferentiationResult } from "../types";

interface Props {
  data: DifferentiationResult;
}

type LevelKey = "blue_ocean" | "moderate" | "red_ocean";

const LEVEL_CONFIG: Record<LevelKey, { label: string; color: string; Icon: typeof Waves }> = {
  blue_ocean: { label: "블루오션", color: "text-go", Icon: Waves },
  moderate: { label: "보통 경쟁", color: "text-pivot", Icon: Swords },
  red_ocean: { label: "레드오션", color: "text-kill", Icon: Flame },
};

export default function DifferentiationCard({ data }: Props) {
  const config = LEVEL_CONFIG[data.competition_level as LevelKey] || LEVEL_CONFIG.moderate;
  const LevelIcon = config.Icon;

  return (
    <div className="space-y-4">
      {/* Competition level */}
      <div className="flex items-center gap-4">
        <div className={`text-5xl font-black ${config.color}`}>{data.competition_score}</div>
        <div>
          <div className={`flex items-center gap-2 text-lg font-bold ${config.color}`}>
            <LevelIcon className="h-5 w-5" />
            {config.label}
          </div>
          <div className="text-sm text-slate-500">{data.summary}</div>
        </div>
      </div>

      {/* Existing solutions */}
      {data.existing_solutions.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <Swords className="h-4 w-4" /> 기존 솔루션
          </h4>
          {data.existing_solutions.map((s, i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <div className="min-w-0">
                <span className="font-medium text-slate-700">{s.name}</span>
                <span className="ml-2 text-sm text-slate-400">— {s.weakness}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-slate-400">유사도</span>
                <span className={`font-mono font-bold ${s.similarity > 70 ? "text-kill" : s.similarity > 40 ? "text-pivot" : "text-go"}`}>
                  {s.similarity}%
                </span>
              </div>
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
            <div key={i} className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-600">
              {angle}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
