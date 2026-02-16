"use client";

import type { Verdict } from "@/lib/types";
import { Shield, ShieldAlert, ShieldX } from "lucide-react";

interface TrustScoreHeroProps {
  trustScore: number;
  verdict: Verdict;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  analysisMode: string;
  source: string;
}

const VERDICT_CONFIG = {
  trustworthy: {
    label: "신뢰할 수 있음",
    color: "var(--color-trust)",
    bgClass: "bg-green-500/10 border-green-500/30",
    textClass: "text-green-400",
    Icon: Shield,
  },
  suspect: {
    label: "주의 필요",
    color: "var(--color-suspect)",
    bgClass: "bg-yellow-500/10 border-yellow-500/30",
    textClass: "text-yellow-400",
    Icon: ShieldAlert,
  },
  clickbait: {
    label: "낚시 의심",
    color: "var(--color-clickbait)",
    bgClass: "bg-red-500/10 border-red-500/30",
    textClass: "text-red-400",
    Icon: ShieldX,
  },
} as const;

export default function TrustScoreHero({
  trustScore,
  verdict,
  title,
  channelName,
  thumbnailUrl,
  analysisMode,
  source,
}: TrustScoreHeroProps) {
  const config = VERDICT_CONFIG[verdict];
  const Icon = config.Icon;

  // SVG circular gauge
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const progress = (trustScore / 100) * circumference;
  const dashOffset = circumference - progress;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* 썸네일 + 제목 */}
      <div className="flex gap-4 mb-6 items-start">
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt={title}
            className="w-40 h-auto rounded-lg flex-shrink-0 object-cover"
          />
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-snug line-clamp-2 mb-1">
            {title}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {channelName}
          </p>
          {source === "fixture" && (
            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              샘플 데이터 모드
            </span>
          )}
        </div>
      </div>

      {/* 점수 게이지 */}
      <div className={`flex items-center gap-8 p-6 rounded-2xl border ${config.bgClass}`}>
        <div className="relative w-28 h-28 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-white/5"
            />
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke={config.color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="animate-score-fill"
              style={{ "--score-offset": dashOffset } as React.CSSProperties}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold" style={{ color: config.color }}>
              {trustScore}
            </span>
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Icon className={`w-6 h-6 ${config.textClass}`} />
            <span className={`text-xl font-bold ${config.textClass}`}>
              {config.label}
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            신뢰도 점수 {trustScore}/100
            {analysisMode !== "full" && analysisMode !== "fixture" && (
              <span className="ml-2 text-xs opacity-60">
                ({analysisMode === "no_transcript" ? "자막 없음" : "댓글 부족"} — 가중치 조정됨)
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
