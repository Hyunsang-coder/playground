import { YoutubeTranscript } from "youtube-transcript";
import type { TranscriptSegment } from "../types";

const MAX_LENGTH = Number(process.env.TRANSCRIPT_MAX_LENGTH ?? 8000);

export async function fetchTranscript(
  videoId: string
): Promise<TranscriptSegment[] | null> {
  try {
    const raw = await YoutubeTranscript.fetchTranscript(videoId, { lang: "ko" });
    if (raw.length > 0) return sampleSegments(normalize(raw));
  } catch {
    // Korean not available, try English
  }

  try {
    const raw = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
    if (raw.length > 0) return sampleSegments(normalize(raw));
  } catch {
    // English not available, try auto
  }

  try {
    const raw = await YoutubeTranscript.fetchTranscript(videoId);
    if (raw.length > 0) return sampleSegments(normalize(raw));
  } catch {
    return null;
  }

  return null;
}

function normalize(
  raw: { text: string; offset: number; duration: number }[]
): TranscriptSegment[] {
  return raw.map((s) => ({
    text: s.text.trim(),
    offset: Math.round(s.offset),
    duration: Math.round(s.duration),
  }));
}

/** 긴 자막일 경우 앞 30% + 중간 30% + 끝 40% 추출 */
function sampleSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  const fullText = segments.map((s) => s.text).join(" ");
  if (fullText.length <= MAX_LENGTH) return segments;

  const len = segments.length;
  const front = segments.slice(0, Math.floor(len * 0.3));
  const midStart = Math.floor(len * 0.35);
  const midEnd = Math.floor(len * 0.65);
  const middle = segments.slice(midStart, midEnd);
  const back = segments.slice(Math.floor(len * 0.6));

  return [...front, ...middle, ...back];
}

/** 자막 세그먼트를 하나의 텍스트로 결합 */
export function transcriptToText(segments: TranscriptSegment[]): string {
  return segments.map((s) => s.text).join(" ");
}
