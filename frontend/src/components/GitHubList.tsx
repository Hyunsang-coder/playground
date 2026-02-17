import { Star, ExternalLink } from "lucide-react";
import type { GitHubSearchResult } from "../types";

interface Props {
  data: GitHubSearchResult;
}

export default function GitHubList({ data }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{data.summary}</span>
        <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-mono">
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
              className="flex items-start gap-3 rounded-xl border border-gray-800 p-3 transition-colors hover:border-gray-600 hover:bg-gray-800/50"
            >
              <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-gray-500" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-gray-200 truncate">
                    {r.name}
                  </span>
                  {r.language && (
                    <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                      {r.language}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-gray-500 line-clamp-2">
                  {r.description || "설명 없음"}
                </div>
              </div>
              <div className="flex items-center gap-1 text-sm text-pivot">
                <Star className="h-4 w-4" />
                <span>{r.stars.toLocaleString()}</span>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-go/20 bg-go/5 p-4 text-center text-go">
          유사한 오픈소스 프로젝트가 없습니다!
        </div>
      )}
    </div>
  );
}
