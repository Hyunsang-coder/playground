"use client";

import type { AnalysisResult } from "@/lib/types";
import { Lightbulb } from "lucide-react";

interface SummaryCardProps {
  result: AnalysisResult;
}

const MODE_LABELS: Record<string, string> = {
  full: "자막 + 댓글 + 메타데이터 종합 분석",
  no_transcript: "댓글 + 메타데이터 분석 (자막 없음)",
  no_comments: "자막 + 메타데이터 분석 (댓글 부족)",
  fixture: "샘플 데이터 기반 분석",
};

export default function SummaryCard({ result }: SummaryCardProps) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-5 h-5 text-yellow-400" />
        <h3 className="font-bold">종합 판단</h3>
      </div>

      <p className="text-[var(--color-text)] leading-relaxed mb-4">
        {result.summary}
      </p>

      <div className="text-xs text-[var(--color-text-secondary)] flex items-center gap-2">
        <span className="px-2 py-0.5 rounded-full bg-white/5 border border-[var(--color-border)]">
          {MODE_LABELS[result.analysisMode] ?? result.analysisMode}
        </span>
      </div>
    </div>
  );
}
