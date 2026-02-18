"use client";

import { CheckCircle2, XCircle, AlertTriangle, Zap, Link } from "lucide-react";
import type { FeasibilityResult } from "../types";

interface Props {
  data: FeasibilityResult;
}

const FEASIBILITY_CONFIG = {
  possible: { label: "구현 가능", color: "text-go", bg: "bg-emerald-50", border: "border-emerald-200" },
  partial: { label: "부분 가능", color: "text-pivot", bg: "bg-amber-50", border: "border-amber-200" },
  difficult: { label: "구현 어려움", color: "text-kill", bg: "bg-rose-50", border: "border-rose-200" },
};

const DIFFICULTY_COLORS = {
  easy: "text-go",
  medium: "text-pivot",
  hard: "text-kill",
};

const VIBE_DIFFICULTY_CONFIG = {
  easy: { label: "쉬움", emoji: "🟢", color: "text-go", bg: "bg-emerald-50", border: "border-emerald-200" },
  medium: { label: "보통", emoji: "🟡", color: "text-pivot", bg: "bg-amber-50", border: "border-amber-200" },
  hard: { label: "어려움", emoji: "🔴", color: "text-kill", bg: "bg-rose-50", border: "border-rose-200" },
};

export default function FeasibilityCard({ data }: Props) {
  const config = FEASIBILITY_CONFIG[data.overall_feasibility] || FEASIBILITY_CONFIG.partial;
  const vibeConfig = VIBE_DIFFICULTY_CONFIG[data.vibe_coding_difficulty] || VIBE_DIFFICULTY_CONFIG.medium;

  return (
    <div className="space-y-4">
      {/* Score & summary */}
      <div className="flex items-center gap-4">
        <div className={`text-5xl font-black ${config.color}`}>{data.score}</div>
        <div>
          <div className={`inline-block rounded-lg px-3 py-1 text-sm font-bold ${config.bg} ${config.color} ${config.border} border`}>
            {config.label}
          </div>
          <div className="mt-1 text-sm text-slate-500">{data.summary}</div>
        </div>
      </div>

      {/* Vibe coding difficulty badge */}
      {data.vibe_coding_difficulty && (
        <div className={`flex items-center gap-3 rounded-xl border ${vibeConfig.border} ${vibeConfig.bg} p-4`}>
          <Zap className={`h-5 w-5 shrink-0 ${vibeConfig.color}`} />
          <div>
            <div className="text-sm text-slate-500">바이브코딩 난이도</div>
            <div className={`text-lg font-bold ${vibeConfig.color}`}>
              {vibeConfig.emoji} {vibeConfig.label}
            </div>
          </div>
        </div>
      )}

      {/* Bottlenecks */}
      {data.bottlenecks && data.bottlenecks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-600">병목 지점</h4>
          {data.bottlenecks.map((bottleneck, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-kill" />
              <span className="text-slate-600">{bottleneck}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tech requirements */}
      {data.tech_requirements.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-600">필요 기술</h4>
          {data.tech_requirements.map((t, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              {t.available ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-go" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 text-kill" />
              )}
              <div className="flex-1">
                <span className="font-medium text-slate-700">{t.name}</span>
                <span className="ml-2 text-sm text-slate-400">{t.note}</span>
              </div>
              <span className={`text-xs font-mono ${DIFFICULTY_COLORS[t.difficulty] || "text-slate-400"}`}>
                {t.difficulty}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Risks */}
      {data.key_risks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-600">외부 의존성 리스크</h4>
          {data.key_risks.map((risk, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <Link className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span className="text-slate-500">{risk}</span>
            </div>
          ))}
        </div>
      )}

      {/* Time estimate */}
      {data.time_estimate && (
        <div className="text-sm text-slate-400">
          예상 개발 시간: <span className="font-medium text-slate-600">{data.time_estimate}</span>
        </div>
      )}
    </div>
  );
}
