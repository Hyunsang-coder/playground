"use client";

import { Star, ExternalLink } from "lucide-react";
import type { GitHubSearchResult } from "../types";

interface Props {
  data: GitHubSearchResult;
}

export default function GitHubList({ data }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{data.summary}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-mono text-slate-600">
          총 {data.total_count.toLocaleString()}개
        </span>
      </div>

      {data.repos.length > 0 ? (
        <div className="space-y-2">
          {data.repos.slice(0, 5).map((r, i) => (
            <a
              key={i}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
            >
              <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-slate-700 truncate">
                    {r.name}
                  </span>
                  {r.language && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {r.language}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-slate-400 line-clamp-2">
                  {r.description || "설명 없음"}
                </div>
              </div>
              <div className="flex items-center gap-1 text-sm text-amber-500">
                <Star className="h-4 w-4" />
                <span>{r.stars.toLocaleString()}</span>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-go font-medium">
          유사한 오픈소스 프로젝트가 없습니다!
        </div>
      )}
    </div>
  );
}
