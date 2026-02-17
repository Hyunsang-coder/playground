import { ExternalLink } from "lucide-react";
import type { WebSearchResult } from "../types";

interface Props {
  data: WebSearchResult;
}

export default function CompetitorList({ data }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{data.summary}</span>
        <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-mono">
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
              className="flex items-start gap-3 rounded-xl border border-gray-800 p-3 transition-colors hover:border-gray-600 hover:bg-gray-800/50"
            >
              <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-gray-500" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-200 truncate">{c.title}</div>
                <div className="mt-1 text-sm text-gray-500 line-clamp-2">{c.snippet}</div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-go/20 bg-go/5 p-4 text-center text-go">
          경쟁 제품을 찾지 못했습니다 — 블루오션 가능성!
        </div>
      )}
    </div>
  );
}
