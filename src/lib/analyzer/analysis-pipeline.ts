import type {
  VideoMetadata,
  VideoComment,
  TranscriptSegment,
  TranscriptAnalysis,
  CommentAnalysis,
  MetadataAnalysis,
  AnalysisResult,
  VideoTypeInfo,
} from "../types";
import { detectVideoType } from "./edge-cases";
import { calculateMetaScore } from "./metadata-scorer";
import { analyzeTranscript } from "./transcript-analyzer";
import { analyzeComments } from "./comment-analyzer";
import { combineFinalScore } from "./score-combiner";

export interface AnalysisContext {
  metadata: VideoMetadata;
  transcript: TranscriptSegment[] | null;
  comments: VideoComment[];
  videoTypeInfo: VideoTypeInfo;
}

export interface AnalysisLayerResult {
  transcriptAnalysis: TranscriptAnalysis | null;
  commentAnalysis: CommentAnalysis | null;
  metadataAnalysis: MetadataAnalysis;
}

/** 전체 분석 파이프라인 실행 */
export async function runAnalysisPipeline(
  metadata: VideoMetadata,
  transcript: TranscriptSegment[] | null,
  comments: VideoComment[]
): Promise<AnalysisResult> {
  const videoTypeInfo = detectVideoType(metadata);

  // 영상 유형에 따라 자막 스킵
  const effectiveTranscript = videoTypeInfo.skipTranscript ? null : transcript;

  // Layer 1: 메타데이터 (동기, 즉시)
  const metadataAnalysis = calculateMetaScore(metadata);

  // Layer 2 & 3: 자막 + 댓글 (비동기 병렬)
  let transcriptAnalysis: TranscriptAnalysis | null = null;
  let commentAnalysis: CommentAnalysis | null = null;

  try {
    [transcriptAnalysis, commentAnalysis] = await Promise.all([
      effectiveTranscript
        ? analyzeTranscript(metadata.title, effectiveTranscript)
        : Promise.resolve(null),
      comments.length > 0
        ? analyzeComments(metadata.title, comments)
        : Promise.resolve(null),
    ]);
  } catch (e) {
    console.error("Analysis layers failed, falling back to metadata only:", e);
  }

  // 종합 점수 계산
  const combined = combineFinalScore(
    transcriptAnalysis,
    commentAnalysis,
    metadataAnalysis
  );

  return {
    videoId: metadata.videoId,
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

    summary: buildSummary(
      combined.verdict,
      transcriptAnalysis?.summary,
      videoTypeInfo
    ),

    source: "youtube",
  };
}

function buildSummary(
  verdict: string,
  transcriptSummary?: string | null,
  videoTypeInfo?: VideoTypeInfo
): string {
  const prefix =
    videoTypeInfo?.reason && videoTypeInfo.type !== "normal"
      ? `[${videoTypeInfo.reason}] `
      : "";

  if (transcriptSummary) return prefix + transcriptSummary;

  switch (verdict) {
    case "trustworthy":
      return prefix + "이 영상의 제목은 실제 내용과 대체로 일치합니다. 신뢰할 수 있는 콘텐츠입니다.";
    case "suspect":
      return prefix + "이 영상의 제목은 일부 과장이 있을 수 있습니다. 내용을 직접 확인하는 것을 권장합니다.";
    case "clickbait":
      return prefix + "이 영상의 제목은 실제 내용과 상당한 차이가 있을 수 있습니다. 주의가 필요합니다.";
    default:
      return prefix + "분석이 완료되었습니다.";
  }
}
