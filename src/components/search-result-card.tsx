"use client";

import type { SearchResultItem, Verdict } from "@/lib/types";
import { Eye, ThumbsUp, Clock, Shield, ShieldAlert, ShieldX, Loader2 } from "lucide-react";

interface SearchResultCardProps {
  item: SearchResultItem;
  onClick: (videoId: string) => void;
}

function formatDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  const h = match[1] ? `${match[1]}:` : "";
  const m = match[2] ?? "0";
  const s = (match[3] ?? "0").padStart(2, "0");
  return h ? `${h}${m.padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function formatCount(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}만`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}천`;
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "오늘";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

const VERDICT_STYLE: Record<
  Verdict,
  { label: string; bg: string; text: string; Icon: typeof Shield }
> = {
  trustworthy: {
    label: "신뢰",
    bg: "bg-green-500/20 border-green-500/40",
    text: "text-green-400",
    Icon: Shield,
  },
  suspect: {
    label: "주의",
    bg: "bg-yellow-500/20 border-yellow-500/40",
    text: "text-yellow-400",
    Icon: ShieldAlert,
  },
  clickbait: {
    label: "낚시 의심",
    bg: "bg-red-500/20 border-red-500/40",
    text: "text-red-400",
    Icon: ShieldX,
  },
};

export default function SearchResultCard({
  item,
  onClick,
}: SearchResultCardProps) {
  const duration = formatDuration(item.duration);

  return (
    <button
      onClick={() => onClick(item.videoId)}
      className="w-full text-left bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl hover:border-red-500/30 hover:bg-[var(--color-surface-hover)] transition-all group"
    >
      <div className="flex gap-4 p-3">
        {/* 썸네일 */}
        <div className="relative w-44 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-black/20">
          {item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--color-text-secondary)]">
              <Eye className="w-6 h-6" />
            </div>
          )}
          {duration && (
            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 text-xs font-mono bg-black/80 text-white rounded">
              {duration}
            </span>
          )}
        </div>

        {/* 정보 */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div>
            <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-red-400 transition-colors">
              {item.title}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              {item.channelName}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {formatCount(item.viewCount)}
            </span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-3 h-3" />
              {formatCount(item.likeCount)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(item.publishedAt)}
            </span>
          </div>
        </div>

        {/* 신뢰도 점수 */}
        <div className="flex-shrink-0 flex items-center">
          <TrustBadge
            status={item.analysisStatus}
            score={item.trustScore}
            verdict={item.verdict}
          />
        </div>
      </div>
    </button>
  );
}

function TrustBadge({
  status,
  score,
  verdict,
}: {
  status: SearchResultItem["analysisStatus"];
  score?: number;
  verdict?: Verdict;
}) {
  if (status === "loading" || status === "pending") {
    return (
      <div className="w-16 h-16 rounded-xl bg-white/5 border border-[var(--color-border)] flex flex-col items-center justify-center gap-1">
        <Loader2 className="w-5 h-5 text-[var(--color-text-secondary)] animate-spin" />
        <span className="text-[10px] text-[var(--color-text-secondary)]">
          분석중
        </span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="w-16 h-16 rounded-xl bg-white/5 border border-[var(--color-border)] flex flex-col items-center justify-center gap-1">
        <span className="text-xs text-[var(--color-text-secondary)]">—</span>
      </div>
    );
  }

  if (status === "done" && verdict && score !== undefined) {
    const style = VERDICT_STYLE[verdict];
    const VerdictIcon = style.Icon;
    return (
      <div
        className={`w-16 h-16 rounded-xl border flex flex-col items-center justify-center gap-0.5 ${style.bg}`}
      >
        <span className={`text-lg font-bold font-mono ${style.text}`}>
          {score}
        </span>
        <div className={`flex items-center gap-0.5 ${style.text}`}>
          <VerdictIcon className="w-3 h-3" />
          <span className="text-[10px] font-medium">{style.label}</span>
        </div>
      </div>
    );
  }

  return null;
}
