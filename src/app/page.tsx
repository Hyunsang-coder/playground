"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import UrlInput from "@/components/url-input";
import LoadingState from "@/components/loading-state";
import TrustScoreHero from "@/components/trust-score-hero";
import ClaimVerificationCard from "@/components/claim-verification-card";
import CommentSentimentCard from "@/components/comment-sentiment-card";
import MetadataScoreCard from "@/components/metadata-score-card";
import ScoreBreakdownChart from "@/components/score-breakdown-chart";
import SummaryCard from "@/components/summary-card";
import { RotateCcw } from "lucide-react";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (url: string) => {
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error.message);
      } else {
        setResult(data.result);
      }
    } catch {
      setError("서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <main className="min-h-screen px-4 py-12">
      {/* 입력 화면 (결과가 없을 때) */}
      {!result && !isLoading && (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <UrlInput onSubmit={handleAnalyze} isLoading={isLoading} />
          {error && (
            <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm max-w-md text-center">
              {error}
            </div>
          )}
        </div>
      )}

      {/* 로딩 */}
      {isLoading && <LoadingState />}

      {/* 결과 화면 */}
      {result && (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in-up">
          {/* 돌아가기 버튼 */}
          <button
            onClick={handleReset}
            className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            다른 영상 분석하기
          </button>

          {/* 신뢰도 점수 */}
          <TrustScoreHero
            trustScore={result.trustScore}
            verdict={result.verdict}
            title={result.title}
            channelName={result.channelName}
            thumbnailUrl={result.thumbnailUrl}
            analysisMode={result.analysisMode}
            source={result.source}
          />

          {/* 종합 요약 */}
          <SummaryCard result={result} />

          {/* 자막 약속 검증 */}
          {result.transcriptAnalysis && (
            <ClaimVerificationCard analysis={result.transcriptAnalysis} />
          )}

          {/* 댓글 분석 + 메타데이터 분석 (2열) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {result.commentAnalysis && (
              <CommentSentimentCard analysis={result.commentAnalysis} />
            )}
            <MetadataScoreCard analysis={result.metadataAnalysis} />
          </div>

          {/* 점수 구성 차트 */}
          <ScoreBreakdownChart result={result} />

          {/* 푸터 */}
          <div className="text-center text-xs text-[var(--color-text-secondary)] pt-4 pb-8">
            낚시 판별기 — AI 기반 YouTube 콘텐츠 신뢰도 분석 도구
            <br />
            OKKY 바이브 코딩 해커톤 2026 출품작
          </div>
        </div>
      )}
    </main>
  );
}
