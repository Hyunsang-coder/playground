"use client";

import { useState, useCallback, useRef } from "react";
import type { AnalysisResult, SearchResultItem } from "@/lib/types";
import SearchInput from "@/components/search-input";
import SearchResultCard from "@/components/search-result-card";
import TrustScoreFilter from "@/components/trust-score-filter";
import LoadingState from "@/components/loading-state";
import TrustScoreHero from "@/components/trust-score-hero";
import ClaimVerificationCard from "@/components/claim-verification-card";
import CommentSentimentCard from "@/components/comment-sentiment-card";
import MetadataScoreCard from "@/components/metadata-score-card";
import ScoreBreakdownChart from "@/components/score-breakdown-chart";
import SummaryCard from "@/components/summary-card";
import { RotateCcw, ArrowLeft, Search } from "lucide-react";

type View = "home" | "search" | "loading" | "detail";

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [detailResult, setDetailResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minScore, setMinScore] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // 키워드 검색
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    setIsSearching(true);
    setSearchResults([]);
    setError(null);
    setView("search");
    setMinScore(0);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error.message);
        return;
      }

      const results: SearchResultItem[] = data.results;
      setSearchResults(results);

      // 비동기로 각 영상의 신뢰도 점수 로딩
      loadScoresAsync(results);
    } catch {
      setError("검색 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 비동기 신뢰도 점수 로딩
  const loadScoresAsync = useCallback((results: SearchResultItem[]) => {
    // 이전 요청 중단
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    results.forEach(async (item) => {
      if (controller.signal.aborted) return;

      // 로딩 상태로 변경
      setSearchResults((prev) =>
        prev.map((r) =>
          r.videoId === item.videoId
            ? { ...r, analysisStatus: "loading" as const }
            : r
        )
      );

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: item.videoId }),
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        const data = await res.json();
        if (data.result) {
          setSearchResults((prev) =>
            prev.map((r) =>
              r.videoId === item.videoId
                ? {
                    ...r,
                    trustScore: data.result.trustScore,
                    verdict: data.result.verdict,
                    analysisStatus: "done" as const,
                  }
                : r
            )
          );
        } else {
          setSearchResults((prev) =>
            prev.map((r) =>
              r.videoId === item.videoId
                ? { ...r, analysisStatus: "error" as const }
                : r
            )
          );
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setSearchResults((prev) =>
          prev.map((r) =>
            r.videoId === item.videoId
              ? { ...r, analysisStatus: "error" as const }
              : r
          )
        );
      }
    });
  }, []);

  // URL 직접 분석
  const handleAnalyzeUrl = useCallback(async (url: string) => {
    setView("loading");
    setError(null);
    setDetailResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error.message);
        setView("home");
      } else {
        setDetailResult(data.result);
        setView("detail");
      }
    } catch {
      setError("서버와 통신할 수 없습니다.");
      setView("home");
    }
  }, []);

  // 검색 결과 카드 클릭 → 상세 분석
  const handleCardClick = useCallback(async (videoId: string) => {
    setView("loading");
    setError(null);
    setDetailResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error.message);
        setView("search");
      } else {
        setDetailResult(data.result);
        setView("detail");
      }
    } catch {
      setError("서버와 통신할 수 없습니다.");
      setView("search");
    }
  }, []);

  const handleReset = () => {
    abortRef.current?.abort();
    setView("home");
    setDetailResult(null);
    setSearchResults([]);
    setError(null);
    setMinScore(0);
  };

  const handleBackToSearch = () => {
    setView("search");
    setDetailResult(null);
  };

  // 필터 적용
  const filteredResults = searchResults.filter((r) => {
    if (r.analysisStatus !== "done" || r.trustScore === undefined) return true;
    return r.trustScore >= minScore;
  });

  const doneCount = searchResults.filter(
    (r) => r.analysisStatus === "done"
  ).length;

  return (
    <main className="min-h-screen px-4 py-12">
      {/* === 홈 화면 === */}
      {view === "home" && (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <SearchInput
            onSearch={handleSearch}
            onAnalyzeUrl={handleAnalyzeUrl}
            isLoading={false}
          />
          {error && (
            <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm max-w-md text-center">
              {error}
            </div>
          )}
        </div>
      )}

      {/* === 검색 결과 === */}
      {view === "search" && (
        <div className="max-w-3xl mx-auto space-y-4 animate-fade-in-up">
          {/* 헤더 */}
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              처음으로
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Search className="w-4 h-4" />
              <span>&quot;{searchQuery}&quot; 검색 결과</span>
            </div>
          </div>

          {/* 필터 (분석 완료된 결과가 있을 때만) */}
          {doneCount > 0 && (
            <TrustScoreFilter
              minScore={minScore}
              onChange={setMinScore}
              totalCount={searchResults.length}
              filteredCount={filteredResults.length}
            />
          )}

          {/* 로딩 */}
          {isSearching && (
            <div className="py-12 text-center text-[var(--color-text-secondary)]">
              <div className="animate-spin inline-block w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full mb-3" />
              <p className="text-sm">검색 중...</p>
            </div>
          )}

          {/* 에러 */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* 결과 카드들 */}
          {!isSearching && filteredResults.length > 0 && (
            <div className="space-y-3">
              {filteredResults.map((item) => (
                <SearchResultCard
                  key={item.videoId}
                  item={item}
                  onClick={handleCardClick}
                />
              ))}
            </div>
          )}

          {/* 결과 없음 */}
          {!isSearching && !error && searchResults.length === 0 && (
            <div className="py-12 text-center text-[var(--color-text-secondary)]">
              <p className="text-sm">검색 결과가 없습니다.</p>
            </div>
          )}

          {/* 필터로 모두 숨겨진 경우 */}
          {!isSearching &&
            searchResults.length > 0 &&
            filteredResults.length === 0 && (
              <div className="py-8 text-center text-[var(--color-text-secondary)]">
                <p className="text-sm">
                  최소 점수 {minScore}점 이상의 결과가 없습니다.
                </p>
                <button
                  onClick={() => setMinScore(0)}
                  className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  필터 초기화
                </button>
              </div>
            )}

          {/* 푸터 */}
          <div className="text-center text-xs text-[var(--color-text-secondary)] pt-4 pb-8">
            진실성 필터 — AI 기반 YouTube 콘텐츠 신뢰도 분석 도구
          </div>
        </div>
      )}

      {/* === 로딩 === */}
      {view === "loading" && <LoadingState />}

      {/* === 상세 분석 결과 === */}
      {view === "detail" && detailResult && (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in-up">
          {/* 돌아가기 */}
          <div className="flex items-center gap-3">
            {searchResults.length > 0 ? (
              <button
                onClick={handleBackToSearch}
                className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                검색 결과로 돌아가기
              </button>
            ) : (
              <button
                onClick={handleReset}
                className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                다른 영상 분석하기
              </button>
            )}
          </div>

          {/* 신뢰도 점수 */}
          <TrustScoreHero
            trustScore={detailResult.trustScore}
            verdict={detailResult.verdict}
            title={detailResult.title}
            channelName={detailResult.channelName}
            thumbnailUrl={detailResult.thumbnailUrl}
            analysisMode={detailResult.analysisMode}
            source={detailResult.source}
          />

          {/* 종합 요약 */}
          <SummaryCard result={detailResult} />

          {/* 자막 약속 검증 */}
          {detailResult.transcriptAnalysis && (
            <ClaimVerificationCard
              analysis={detailResult.transcriptAnalysis}
            />
          )}

          {/* 댓글 분석 + 메타데이터 분석 (2열) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {detailResult.commentAnalysis && (
              <CommentSentimentCard
                analysis={detailResult.commentAnalysis}
              />
            )}
            <MetadataScoreCard analysis={detailResult.metadataAnalysis} />
          </div>

          {/* 점수 구성 차트 */}
          <ScoreBreakdownChart result={detailResult} />

          {/* 푸터 */}
          <div className="text-center text-xs text-[var(--color-text-secondary)] pt-4 pb-8">
            진실성 필터 — AI 기반 YouTube 콘텐츠 신뢰도 분석 도구
            <br />
            OKKY 바이브 코딩 해커톤 2026 출품작
          </div>
        </div>
      )}
    </main>
  );
}
