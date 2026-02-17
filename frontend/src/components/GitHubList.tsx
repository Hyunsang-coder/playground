import { Star, ExternalLink, GitFork, Clock, Tag } from "lucide-react";
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

      {/* Search strategies used */}
      {data.strategies_used && data.strategies_used.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.strategies_used.map((s, i) => (
            <span key={i} className="rounded-full bg-gray-800/50 px-2.5 py-0.5 text-xs text-gray-500">
              {s}
            </span>
          ))}
        </div>
      )}

      {data.repos.length > 0 ? (
        <div className="space-y-2">
          {data.repos.slice(0, 5).map((r, i) => (
            <a
              key={i}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-gray-800 p-3 transition-colors hover:border-gray-600 hover:bg-gray-800/50"
            >
              <div className="flex items-start gap-3">
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

                  {/* Topics */}
                  {r.topics && r.topics.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {r.topics.slice(0, 4).map((topic, j) => (
                        <span key={j} className="flex items-center gap-0.5 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
                          <Tag className="h-2.5 w-2.5" />
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Activity indicators */}
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-pivot" />
                      {r.stars.toLocaleString()}
                    </span>
                    {(r.forks ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <GitFork className="h-3 w-3" />
                        {r.forks?.toLocaleString()}
                      </span>
                    )}
                    {(r.recent_commits ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-go">
                        <Clock className="h-3 w-3" />
                        최근 커밋 {r.recent_commits}개
                      </span>
                    )}
                    {r.last_commit_date && (
                      <span className="text-gray-600">
                        마지막: {r.last_commit_date}
                      </span>
                    )}
                  </div>
                </div>
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
