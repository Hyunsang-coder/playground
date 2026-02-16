import { z } from "zod";

export const claimVerificationSchema = z.object({
  claim: z.string(),
  evidence: z.string(),
  score: z.number().min(0).max(100),
  met: z.boolean(),
});

export const transcriptAnalysisSchema = z.object({
  claims: z.array(claimVerificationSchema).min(1).max(5),
  overall_score: z.number().min(0).max(100),
  summary: z.string(),
});

export const commentAiResultSchema = z.object({
  mismatch_complaints: z.number().min(0),
  satisfied: z.number().min(0),
  ad_complaints: z.number().min(0),
  comment_score: z.number().min(0).max(100),
});

export type TranscriptAnalysisRaw = z.infer<typeof transcriptAnalysisSchema>;
export type CommentAiResultRaw = z.infer<typeof commentAiResultSchema>;
