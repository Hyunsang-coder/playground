import Anthropic from "@anthropic-ai/sdk";
import type { TranscriptAnalysis, TranscriptSegment } from "../types";
import { transcriptAnalysisSchema } from "./schema";
import { buildTranscriptPrompt } from "./prompt";
import { transcriptToText } from "../youtube/fetch-transcript";

const anthropic = new Anthropic();

export async function analyzeTranscript(
  title: string,
  segments: TranscriptSegment[]
): Promise<TranscriptAnalysis | null> {
  const text = transcriptToText(segments);
  if (!text || text.length < 30) return null;

  const prompt = buildTranscriptPrompt(title, text);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      });

      const content = message.content[0];
      if (content.type !== "text") continue;

      const json = extractJson(content.text);
      const parsed = transcriptAnalysisSchema.parse(json);

      return {
        claims: parsed.claims.map((c) => ({
          claim: c.claim,
          evidence: c.evidence,
          score: c.score,
          met: c.met,
        })),
        overallScore: parsed.overall_score,
        summary: parsed.summary,
      };
    } catch (e) {
      console.error(`Transcript analysis attempt ${attempt + 1} failed:`, e);
      if (attempt === 0) continue;
    }
  }

  return null;
}

function extractJson(text: string): unknown {
  // Try to extract JSON from possible markdown code blocks
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlock ? codeBlock[1].trim() : text.trim();
  return JSON.parse(jsonStr);
}
