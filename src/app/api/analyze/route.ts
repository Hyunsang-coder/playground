import { NextResponse } from "next/server";
import { fetchMetadata, fetchComments } from "@/lib/youtube/fetch-metadata";
import { fetchTranscript } from "@/lib/youtube/fetch-transcript";
import { calculateMetaScore } from "@/lib/analyzer/metadata-scorer";
import { analyzeTranscript } from "@/lib/analyzer/transcript-analyzer";
import { analyzeComments } from "@/lib/analyzer/comment-analyzer";
import { combineFinalScore } from "@/lib/analyzer/score-combiner";
import { getCached, setCache, generateAnalysisId } from "@/lib/cache/memory-store";
import { DEMO_RESULT } from "@/lib/fixtures/demo-result";
import type { AnalysisResult } from "@/lib/types";

function extractVideoId(url: string): string | null {
  // youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/
  );
  if (watchMatch) return watchMatch[1];

  // youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  // youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
  );
  if (embedMatch) return embedMatch[1];

  // youtube.com/shorts/VIDEO_ID
  const shortsMatch = url.match(
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  );
  if (shortsMatch) return shortsMatch[1];

  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: { code: "INVALID_URL", message: "URL을 입력해주세요." } },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_URL",
            message: "유효한 YouTube URL이 아닙니다. youtube.com 또는 youtu.be 링크를 입력해주세요.",
          },
        },
        { status: 400 }
      );
    }

    // 캐시 확인
    const cached = getCached(videoId);
    if (cached) {
      return NextResponse.json({
        analysisId: generateAnalysisId(),
        result: cached,
      });
    }

    // 데이터 수집 (병렬)
    let metadata;
    let comments;
    let transcript;

    try {
      [metadata, transcript] = await Promise.all([
        fetchMetadata(videoId),
        fetchTranscript(videoId),
      ]);
      comments = await fetchComments(videoId);
    } catch (e) {
      console.error("Data fetch failed, using fixture:", e);
      return NextResponse.json({
        analysisId: generateAnalysisId(),
        result: { ...DEMO_RESULT, videoId, source: "fixture" as const },
      });
    }

    // 3중 분석 (메타데이터는 즉시, LLM 호출은 병렬)
    const metadataAnalysis = calculateMetaScore(metadata);

    let transcriptAnalysis;
    let commentAnalysis;

    try {
      [transcriptAnalysis, commentAnalysis] = await Promise.all([
        transcript ? analyzeTranscript(metadata.title, transcript) : Promise.resolve(null),
        comments.length > 0
          ? analyzeComments(metadata.title, comments)
          : Promise.resolve(null),
      ]);
    } catch (e) {
      console.error("Analysis failed, falling back to metadata only:", e);
      transcriptAnalysis = null;
      commentAnalysis = null;
    }

    // 종합 점수 계산
    const combined = combineFinalScore(
      transcriptAnalysis,
      commentAnalysis,
      metadataAnalysis
    );

    const result: AnalysisResult = {
      videoId,
      title: metadata.title,
      channelName: metadata.channelName,
      thumbnailUrl: metadata.thumbnailUrl,

      trustScore: combined.trustScore,
      clickbaitRisk: combined.clickbaitRisk,
      verdict: combined.verdict,

      transcriptAnalysis,
      commentAnalysis,
      metadataAnalysis,

      analysisMode: combined.analysisMode,
      weights: combined.weights,

      summary: buildSummary(combined.verdict, transcriptAnalysis?.summary),

      source: "youtube",
    };

    // 캐시 저장
    setCache(videoId, result);

    return NextResponse.json({
      analysisId: generateAnalysisId(),
      result,
    });
  } catch (e) {
    console.error("Unexpected error:", e);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        },
      },
      { status: 500 }
    );
  }
}

function buildSummary(
  verdict: string,
  transcriptSummary?: string | null
): string {
  if (transcriptSummary) return transcriptSummary;

  switch (verdict) {
    case "trustworthy":
      return "이 영상의 제목은 실제 내용과 대체로 일치합니다. 신뢰할 수 있는 콘텐츠입니다.";
    case "suspect":
      return "이 영상의 제목은 일부 과장이 있을 수 있습니다. 내용을 직접 확인하는 것을 권장합니다.";
    case "clickbait":
      return "이 영상의 제목은 실제 내용과 상당한 차이가 있을 수 있습니다. 주의가 필요합니다.";
    default:
      return "분석이 완료되었습니다.";
  }
}
