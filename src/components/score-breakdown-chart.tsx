"use client";

import type { AnalysisResult } from "@/lib/types";
import { PieChart } from "lucide-react";

interface ScoreBreakdownChartProps {
  result: AnalysisResult;
}

export default function ScoreBreakdownChart({
  result,
}: ScoreBreakdownChartProps) {
  const { weights, transcriptAnalysis, commentAnalysis, metadataAnalysis } =
    result;

  const layers = [
    {
      label: "자막 분석",
      weight: weights.transcript,
      score: transcriptAnalysis?.overallScore ?? null,
      color: "#3b82f6",
      bgColor: "bg-blue-500",
    },
    {
      label: "댓글 분석",
      weight: weights.comment,
      score: commentAnalysis?.commentScore ?? null,
      color: "#a855f7",
      bgColor: "bg-purple-500",
    },
    {
      label: "메타데이터",
      weight: weights.metadata,
      score: metadataAnalysis.metaScore,
      color: "#f97316",
      bgColor: "bg-orange-500",
    },
  ];

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="w-5 h-5 text-[var(--color-text-secondary)]" />
        <h3 className="font-bold">분석 가중치 · 점수 구성</h3>
      </div>

      <div className="space-y-4">
        {layers.map((layer, i) => {
          if (layer.weight === 0) return null;

          return (
            <div key={i}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${layer.bgColor}`}
                  />
                  {layer.label}
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    ({Math.round(layer.weight * 100)}%)
                  </span>
                </span>
                <span className="font-mono font-bold">
                  {layer.score !== null ? `${layer.score}점` : "N/A"}
                </span>
              </div>
              <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: layer.score !== null ? `${layer.score}%` : "0%",
                    backgroundColor: layer.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 가중 합산 설명 */}
      <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
        <span className="text-sm text-[var(--color-text-secondary)]">
          가중 합산 신뢰도
        </span>
        <span className="text-lg font-bold font-mono">
          {result.trustScore}점
        </span>
      </div>
    </div>
  );
}
