"use client";

import { useState } from "react";
import { Search, Youtube, Sparkles } from "lucide-react";

const SAMPLE_URLS = [
  {
    label: "뉴스 영상",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
  {
    label: "교육 영상",
    url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  },
  {
    label: "리뷰 영상",
    url: "https://www.youtube.com/watch?v=9bZkp7q19f0",
  },
];

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export default function UrlInput({ onSubmit, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim() && !isLoading) {
      onSubmit(url.trim());
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-4">
          <Youtube className="w-10 h-10 text-red-500" />
          <h1 className="text-4xl font-bold tracking-tight">낚시 판별기</h1>
        </div>
        <p className="text-[var(--color-text-secondary)] text-lg">
          YouTube 영상 제목이 약속한 내용, 실제로 지켜졌을까?
        </p>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">
          자막 + 댓글 + 메타데이터 3중 분석으로 낚시를 판별합니다
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)]" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="YouTube URL을 붙여넣으세요"
              className="w-full pl-12 pr-4 py-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all"
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={!url.trim() || isLoading}
            className="px-6 py-4 bg-red-600 hover:bg-red-700 disabled:bg-red-600/30 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Sparkles className="w-5 h-5" />
            분석하기
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 justify-center">
        <span className="text-xs text-[var(--color-text-secondary)]">샘플:</span>
        {SAMPLE_URLS.map((sample) => (
          <button
            key={sample.url}
            onClick={() => {
              setUrl(sample.url);
              onSubmit(sample.url);
            }}
            disabled={isLoading}
            className="text-xs px-3 py-1.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-red-500/50 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-all disabled:opacity-50"
          >
            {sample.label}
          </button>
        ))}
      </div>
    </div>
  );
}
