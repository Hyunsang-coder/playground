import type {
  TranscriptAnalysis,
  CommentAnalysis,
  MetadataAnalysis,
  AnalysisMode,
  Verdict,
} from "../types";

interface CombinedScore {
  trustScore: number;
  clickbaitRisk: number;
  verdict: Verdict;
  weights: { transcript: number; comment: number; metadata: number };
  analysisMode: AnalysisMode;
}

export function combineFinalScore(
  transcript: TranscriptAnalysis | null,
  comment: CommentAnalysis | null,
  metadata: MetadataAnalysis
): CombinedScore {
  const hasTranscript = transcript !== null;
  const hasComments = comment !== null && comment.totalAnalyzed >= 5;

  let trustScore: number;
  let weights: CombinedScore["weights"];
  let analysisMode: AnalysisMode;

  if (hasTranscript && hasComments) {
    trustScore =
      transcript.overallScore * 0.5 +
      comment.commentScore * 0.3 +
      metadata.metaScore * 0.2;
    weights = { transcript: 0.5, comment: 0.3, metadata: 0.2 };
    analysisMode = "full";
  } else if (hasTranscript) {
    trustScore =
      transcript.overallScore * 0.65 + metadata.metaScore * 0.35;
    weights = { transcript: 0.65, comment: 0, metadata: 0.35 };
    analysisMode = "no_comments";
  } else if (hasComments) {
    trustScore =
      comment.commentScore * 0.6 + metadata.metaScore * 0.4;
    weights = { transcript: 0, comment: 0.6, metadata: 0.4 };
    analysisMode = "no_transcript";
  } else {
    trustScore = metadata.metaScore;
    weights = { transcript: 0, comment: 0, metadata: 1 };
    analysisMode = "no_transcript";
  }

  trustScore = Math.round(trustScore);

  let verdict: Verdict;
  if (trustScore >= 70) verdict = "trustworthy";
  else if (trustScore >= 40) verdict = "suspect";
  else verdict = "clickbait";

  return {
    trustScore,
    clickbaitRisk: 100 - trustScore,
    verdict,
    weights,
    analysisMode,
  };
}
