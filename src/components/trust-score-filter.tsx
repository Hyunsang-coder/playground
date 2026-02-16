"use client";

import { Filter } from "lucide-react";

interface TrustScoreFilterProps {
  minScore: number;
  onChange: (value: number) => void;
  totalCount: number;
  filteredCount: number;
}

export default function TrustScoreFilter({
  minScore,
  onChange,
  totalCount,
  filteredCount,
}: TrustScoreFilterProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
      <Filter className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />

      <div className="flex-1 flex items-center gap-3">
        <span className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
          최소 점수
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={minScore}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-red-500
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-red-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
        />
        <span className="text-sm font-mono font-bold text-red-400 w-8 text-right">
          {minScore}
        </span>
      </div>

      <span className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
        {filteredCount}/{totalCount}개 표시
      </span>
    </div>
  );
}
