"use client";

import type { TranscriptAnalysis } from "@/lib/types";
import { CheckCircle, XCircle, FileText } from "lucide-react";

interface ClaimVerificationCardProps {
  analysis: TranscriptAnalysis;
}

export default function ClaimVerificationCard({
  analysis,
}: ClaimVerificationCardProps) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-blue-400" />
        <h3 className="font-bold">자막 기반 약속 검증</h3>
        <span className="ml-auto text-sm font-mono font-bold text-blue-400">
          {analysis.overallScore}점
        </span>
      </div>

      <div className="space-y-3">
        {analysis.claims.map((claim, i) => (
          <div
            key={i}
            className={`p-4 rounded-xl border ${
              claim.met
                ? "border-green-500/20 bg-green-500/5"
                : "border-red-500/20 bg-red-500/5"
            }`}
          >
            <div className="flex items-start gap-3">
              {claim.met ? (
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{claim.claim}</span>
                  <span
                    className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                      claim.met
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {claim.score}점
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  {claim.evidence}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {analysis.summary && (
        <p className="mt-4 text-sm text-[var(--color-text-secondary)] italic border-t border-[var(--color-border)] pt-3">
          {analysis.summary}
        </p>
      )}
    </div>
  );
}
