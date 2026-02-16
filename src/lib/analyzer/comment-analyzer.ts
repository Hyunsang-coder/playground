import Anthropic from "@anthropic-ai/sdk";
import type { VideoComment, CommentAnalysis } from "../types";
import { commentAiResultSchema } from "./schema";
import { buildCommentPrompt } from "./prompt";

const anthropic = new Anthropic();

const NEGATIVE_KEYWORDS = [
  "낚시", "제목 낚시", "시간 낭비", "광고", "뒷광고",
  "제목과 다른", "어그로", "실망", "후회", "clickbait",
  "misleading", "낚였", "제목만", "사기", "뻥",
];

const POSITIVE_KEYWORDS = [
  "유익", "도움", "감사", "알찬", "정리 잘",
  "최고", "구독", "추천", "helpful", "great",
  "좋은 정보", "잘 봤", "공감", "인정",
];

export async function analyzeComments(
  title: string,
  comments: VideoComment[]
): Promise<CommentAnalysis | null> {
  if (comments.length === 0) return null;

  // Stage 1: 키워드 분석
  let negativeCount = 0;
  let positiveCount = 0;

  for (const comment of comments) {
    const lower = comment.text.toLowerCase();
    if (NEGATIVE_KEYWORDS.some((kw) => lower.includes(kw))) negativeCount++;
    if (POSITIVE_KEYWORDS.some((kw) => lower.includes(kw))) positiveCount++;
  }

  const total = negativeCount + positiveCount;
  const keywordScore =
    total > 0 ? Math.round((positiveCount / total) * 100) : 50;

  const keywordResult = {
    negativeCount,
    positiveCount,
    negativeRatio: total > 0 ? negativeCount / total : 0,
  };

  // Stage 2: AI 분석 (댓글이 20개 이상일 때만)
  let aiResult: CommentAnalysis["aiResult"];
  let finalScore: number;

  if (comments.length >= 20) {
    aiResult = await aiAnalyzeComments(title, comments);
    if (aiResult) {
      // AI comment_score와 키워드 점수 혼합 (50:50)
      finalScore = Math.round(keywordScore * 0.5 + (await getAiScore(aiResult)) * 0.5);
    } else {
      finalScore = keywordScore;
    }
  } else {
    finalScore = keywordScore;
  }

  return {
    totalAnalyzed: comments.length,
    keywordResult,
    aiResult,
    commentScore: finalScore,
  };
}

function getAiScore(aiResult: NonNullable<CommentAnalysis["aiResult"]>): number {
  const total =
    aiResult.mismatchComplaints + aiResult.satisfied + aiResult.adComplaints;
  if (total === 0) return 50;
  return Math.round((aiResult.satisfied / total) * 100);
}

async function aiAnalyzeComments(
  title: string,
  comments: VideoComment[]
): Promise<CommentAnalysis["aiResult"] | undefined> {
  const topComments = comments
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, 50)
    .map((c) => c.text);

  const prompt = buildCommentPrompt(title, topComments);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 512,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      });

      const content = message.content[0];
      if (content.type !== "text") continue;

      const codeBlock = content.text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = codeBlock ? codeBlock[1].trim() : content.text.trim();
      const parsed = commentAiResultSchema.parse(JSON.parse(jsonStr));

      return {
        mismatchComplaints: parsed.mismatch_complaints,
        satisfied: parsed.satisfied,
        adComplaints: parsed.ad_complaints,
      };
    } catch (e) {
      console.error(`Comment AI analysis attempt ${attempt + 1} failed:`, e);
      if (attempt === 0) continue;
    }
  }

  return undefined;
}
