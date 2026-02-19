"use client";

import { ExternalLink } from "lucide-react";
import type { WebSearchResult } from "../types";

interface Props {
  data: WebSearchResult;
}

export default function CompetitorList({ data }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{data.summary}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-mono text-slate-600">
          {data.raw_count}개 발견
        </span>
      </div>

      {data.competitors.length > 0 ? (
        <div className="space-y-2">
          {data.competitors.slice(0, 5).map((c, i) => (
            <a
              key={i}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
            >
              <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-700 truncate">{c.title}</div>
                <div className="mt-1 text-sm text-slate-400 line-clamp-2">{c.snippet}</div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-go font-medium">
          경쟁 제품을 찾지 못했습니다 — 블루오션 가능성!
        </div>
      )}
    </div>
  );
}
