import type { TranscriptSegment, VideoTypeInfo } from "../types";

const MAX_LENGTH = Number(process.env.TRANSCRIPT_MAX_LENGTH ?? 8000);
const PYTHON_BACKEND_URL =
  process.env.PYTHON_BACKEND_URL ?? "http://localhost:8001";

export async function fetchTranscript(
  videoId: string,
  videoTypeInfo?: VideoTypeInfo
): Promise<TranscriptSegment[] | null> {
  if (videoTypeInfo?.skipTranscript) return null;

  const sampleRatio = videoTypeInfo?.sampleRatio ?? 1;

  // 1차: Python 백엔드 (youtube-transcript-api)
  try {
    const segments = await fetchFromPythonBackend(videoId);
    if (segments && segments.length > 0) {
      console.log(
        `[Transcript] Python backend success: ${segments.length} segments`
      );
      return sampleSegments(segments, sampleRatio);
    }
  } catch (e) {
    console.warn("[Transcript] Python backend failed, trying fallback:", e);
  }

  // 2차: 기존 innertube ANDROID API fallback
  try {
    const tracks = await getCaptionTracks(videoId);
    if (!tracks || tracks.length === 0) return null;

    const track =
      tracks.find((t) => t.lang === "ko" && !t.isAuto) ??
      tracks.find((t) => t.lang === "ko") ??
      tracks.find((t) => t.lang === "en" && !t.isAuto) ??
      tracks.find((t) => t.lang === "en") ??
      tracks.find((t) => !t.isAuto) ??
      tracks[0];

    const segments = await fetchTimedText(track.baseUrl);
    if (!segments || segments.length === 0) return null;

    console.log(
      `[Transcript] Fallback success: ${segments.length} segments`
    );
    return sampleSegments(segments, sampleRatio);
  } catch (e) {
    console.error("[Transcript] All methods failed:", e);
    return null;
  }
}

// === Python 백엔드 호출 ===

async function fetchFromPythonBackend(
  videoId: string
): Promise<TranscriptSegment[] | null> {
  const res = await fetch(`${PYTHON_BACKEND_URL}/transcript`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data.segments as TranscriptSegment[];
}

// === innertube ANDROID API fallback ===

const ANDROID_API_KEY = "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w";
const ANDROID_CLIENT_VERSION = "19.29.37";

interface CaptionTrack {
  baseUrl: string;
  lang: string;
  isAuto: boolean;
  name: string;
}

async function getCaptionTracks(
  videoId: string
): Promise<CaptionTrack[] | null> {
  const body = {
    context: {
      client: {
        clientName: "ANDROID",
        clientVersion: ANDROID_CLIENT_VERSION,
        hl: "ko",
      },
    },
    videoId,
  };

  try {
    const res = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=${ANDROID_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "com.google.android.youtube/",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json();
    const captions =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captions || captions.length === 0) return null;

    return captions.map(
      (t: {
        baseUrl: string;
        languageCode: string;
        kind?: string;
        name?: { simpleText?: string };
      }) => ({
        baseUrl: t.baseUrl,
        lang: t.languageCode,
        isAuto: t.kind === "asr",
        name: t.name?.simpleText ?? t.languageCode,
      })
    );
  } catch {
    return null;
  }
}

async function fetchTimedText(
  baseUrl: string
): Promise<TranscriptSegment[] | null> {
  try {
    const res = await fetch(baseUrl + "&fmt=json3", {
      headers: { "User-Agent": "com.google.android.youtube/" },
    });
    const data = await res.json();

    if (data.events) {
      const segments = data.events
        .filter((e: { segs?: unknown[] }) => e.segs)
        .map(
          (e: {
            tStartMs: number;
            dDurationMs: number;
            segs: { utf8: string }[];
          }) => ({
            text: e.segs
              .map((s) => s.utf8)
              .join("")
              .trim(),
            offset: e.tStartMs,
            duration: e.dDurationMs ?? 0,
          })
        )
        .filter((s: TranscriptSegment) => s.text.length > 0);

      if (segments.length > 0) return segments;
    }
  } catch {
    // JSON 실패 시 XML fallback
  }

  try {
    const res = await fetch(baseUrl, {
      headers: { "User-Agent": "com.google.android.youtube/" },
    });
    const xml = await res.text();

    const segments: TranscriptSegment[] = [];
    const regex =
      /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)<\/text>/g;
    let m;
    while ((m = regex.exec(xml)) !== null) {
      segments.push({
        offset: Math.round(parseFloat(m[1]) * 1000),
        duration: Math.round(parseFloat(m[2]) * 1000),
        text: decodeXmlEntities(m[3]).trim(),
      });
    }
    return segments.length > 0 ? segments : null;
  } catch {
    return null;
  }
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n/g, " ");
}

// === 샘플링 ===

function sampleSegments(
  segments: TranscriptSegment[],
  sampleRatio: number
): TranscriptSegment[] {
  const fullText = segments.map((s) => s.text).join(" ");
  const effectiveMaxLength = Math.round(MAX_LENGTH * sampleRatio);

  if (fullText.length <= effectiveMaxLength) return segments;

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
