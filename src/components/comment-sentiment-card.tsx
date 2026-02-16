"use client";

import type { CommentAnalysis } from "@/lib/types";
import { MessageCircle, ThumbsUp, ThumbsDown } from "lucide-react";

interface CommentSentimentCardProps {
  analysis: CommentAnalysis;
}

export default function CommentSentimentCard({
  analysis,
}: CommentSentimentCardProps) {
  const { keywordResult, aiResult, totalAnalyzed, commentScore } = analysis;
  const total = keywordResult.positiveCount + keywordResult.negativeCount;
  const positivePercent =
    total > 0
      ? Math.round((keywordResult.positiveCount / total) * 100)
      : 50;

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-5 h-5 text-purple-400" />
        <h3 className="font-bold">댓글 감성 분석</h3>
        <span className="ml-auto text-sm text-[var(--color-text-secondary)]">
          {totalAnalyzed}개 분석
        </span>
        <span className="text-sm font-mono font-bold text-purple-400">
          {commentScore}점
        </span>
      </div>

      {/* 긍정/부정 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="flex items-center gap-1 text-green-400">
            <ThumbsUp className="w-3 h-3" /> 긍정 {keywordResult.positiveCount}
          </span>
          <span className="flex items-center gap-1 text-red-400">
            부정 {keywordResult.negativeCount} <ThumbsDown className="w-3 h-3" />
          </span>
        </div>
        <div className="h-3 bg-red-500/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-1000"
            style={{ width: `${positivePercent}%` }}
          />
        </div>
      </div>

      {/* AI 분석 결과 */}
      {aiResult && (
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[var(--color-border)]">
          <div className="text-center">
            <p className="text-2xl font-bold text-red-400">
              {aiResult.mismatchComplaints}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              내용 불일치 불만
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">
              {aiResult.satisfied}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              만족 댓글
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-400">
              {aiResult.adComplaints}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              광고 불만
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
