"use client";

import type { MetadataAnalysis } from "@/lib/types";
import { BarChart3, AlertTriangle, ThumbsUp } from "lucide-react";

interface MetadataScoreCardProps {
  analysis: MetadataAnalysis;
}

export default function MetadataScoreCard({
  analysis,
}: MetadataScoreCardProps) {
  const {
    metaScore,
    clickbaitWordsFound,
    excessivePunctuation,
    emojiCount,
    likeViewRatio,
    titleSensationalism,
  } = analysis;

  const indicators = [
    {
      label: "자극적 단어",
      value: clickbaitWordsFound.length > 0
        ? clickbaitWordsFound.join(", ")
        : "없음",
      isWarning: clickbaitWordsFound.length > 0,
    },
    {
      label: "과도한 문장부호 (!?)",
      value: `${excessivePunctuation}개`,
      isWarning: excessivePunctuation > 2,
    },
    {
      label: "이모지",
      value: `${emojiCount}개`,
      isWarning: emojiCount > 2,
    },
    {
      label: "좋아요/조회수 비율",
      value: `${(likeViewRatio * 100).toFixed(2)}%`,
      isWarning: likeViewRatio < 0.02,
    },
  ];

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-orange-400" />
        <h3 className="font-bold">메타데이터 분석</h3>
        <span className="ml-auto text-sm font-mono font-bold text-orange-400">
          {metaScore}점
        </span>
      </div>

      {/* 자극성 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-[var(--color-text-secondary)]">제목 자극성</span>
          <span className={titleSensationalism > 40 ? "text-red-400" : "text-green-400"}>
            {titleSensationalism}%
          </span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              titleSensationalism > 60
                ? "bg-red-500"
                : titleSensationalism > 30
                ? "bg-yellow-500"
                : "bg-green-500"
            }`}
            style={{ width: `${titleSensationalism}%` }}
          />
        </div>
      </div>

      {/* 지표 목록 */}
      <div className="space-y-2">
        {indicators.map((ind, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
              {ind.isWarning ? (
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
              ) : (
                <ThumbsUp className="w-3.5 h-3.5 text-green-400" />
              )}
              {ind.label}
            </span>
            <span className={ind.isWarning ? "text-yellow-400" : "text-[var(--color-text-secondary)]"}>
              {ind.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
