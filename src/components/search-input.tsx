"use client";

import { useState } from "react";
import { Search, Youtube, Sparkles, Link } from "lucide-react";

interface SearchInputProps {
  onSearch: (query: string) => void;
  onAnalyzeUrl: (url: string) => void;
  isLoading: boolean;
}

function isYoutubeUrl(text: string): boolean {
  return /(?:youtube\.com|youtu\.be)/.test(text);
}

export default function SearchInput({
  onSearch,
  onAnalyzeUrl,
  isLoading,
}: SearchInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    if (isYoutubeUrl(trimmed)) {
      onAnalyzeUrl(trimmed);
    } else {
      onSearch(trimmed);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-4">
          <Youtube className="w-10 h-10 text-red-500" />
          <h1 className="text-4xl font-bold tracking-tight">진실성 필터</h1>
        </div>
        <p className="text-[var(--color-text-secondary)] text-lg">
          YouTube 영상 제목이 약속한 내용, 실제로 지켜졌을까?
        </p>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">
          키워드 검색 또는 URL 직접 입력 — 자막 + 댓글 + 메타데이터 3중 분석
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="키워드 검색 또는 YouTube URL 붙여넣기"
              className="w-full pl-12 pr-4 py-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all"
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-6 py-4 bg-red-600 hover:bg-red-700 disabled:bg-red-600/30 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            {isYoutubeUrl(input) ? (
              <>
                <Sparkles className="w-5 h-5" />
                분석하기
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                검색
              </>
            )}
          </button>
        </div>
      </form>

      {/* 안내 */}
      <div className="flex items-center justify-center gap-4 text-xs text-[var(--color-text-secondary)]">
        <span className="flex items-center gap-1">
          <Search className="w-3 h-3" />
          키워드로 영상 검색
        </span>
        <span className="text-[var(--color-border)]">|</span>
        <span className="flex items-center gap-1">
          <Link className="w-3 h-3" />
          URL로 바로 분석
        </span>
      </div>
    </div>
  );
}
