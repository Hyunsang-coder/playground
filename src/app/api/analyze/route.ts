import { NextResponse } from "next/server";
import { fetchMetadata, fetchComments } from "@/lib/youtube/fetch-metadata";
import { fetchTranscript } from "@/lib/youtube/fetch-transcript";
import { runAnalysisPipeline } from "@/lib/analyzer/analysis-pipeline";
import { detectVideoType } from "@/lib/analyzer/edge-cases";
import { getCached, setCache, generateAnalysisId } from "@/lib/cache/memory-store";
import { DEMO_RESULT } from "@/lib/fixtures/demo-result";

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
    const url = body.url as string | undefined;
    const videoIdDirect = body.videoId as string | undefined;

    // videoId 직접 전달 또는 URL에서 추출
    let videoId: string | null = videoIdDirect ?? null;
    if (!videoId && url) {
      videoId = extractVideoId(url);
    }

    if (!videoId) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_URL",
            message: "유효한 YouTube URL 또는 videoId를 입력해주세요.",
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

    // 데이터 수집
    let metadata;
    let comments;
    let transcript;

    try {
      metadata = await fetchMetadata(videoId);
      const videoTypeInfo = detectVideoType(metadata);

      [transcript, comments] = await Promise.all([
        fetchTranscript(videoId, videoTypeInfo),
        fetchComments(videoId),
      ]);
    } catch (e) {
      console.error("Data fetch failed, using fixture:", e);
      return NextResponse.json({
        analysisId: generateAnalysisId(),
        result: { ...DEMO_RESULT, videoId, source: "fixture" as const },
      });
    }

    // 분석 파이프라인 실행
    const result = await runAnalysisPipeline(metadata, transcript, comments);

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
