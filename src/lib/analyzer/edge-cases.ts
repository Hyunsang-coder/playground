import type { VideoMetadata, VideoTypeInfo } from "../types";

const MUSIC_CATEGORY_ID = "10";
const LONG_VIDEO_THRESHOLD = 60 * 60; // 1시간 (초)
const SHORTS_THRESHOLD = 61; // 61초 미만

/** ISO 8601 duration (PT10M30S) → 초 */
function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] ?? "0", 10);
  const m = parseInt(match[2] ?? "0", 10);
  const s = parseInt(match[3] ?? "0", 10);
  return h * 3600 + m * 60 + s;
}

export function detectVideoType(meta: VideoMetadata): VideoTypeInfo {
  const durationSec = parseDuration(meta.duration);

  // Shorts (61초 미만)
  if (durationSec > 0 && durationSec < SHORTS_THRESHOLD) {
    return {
      type: "shorts",
      skipTranscript: true,
      sampleRatio: 0,
      reason: "Shorts 영상은 자막 분석이 불필요합니다",
    };
  }

  // 음악 카테고리
  if (meta.categoryId === MUSIC_CATEGORY_ID) {
    return {
      type: "music",
      skipTranscript: true,
      sampleRatio: 0,
      reason: "음악 영상은 가사가 자막으로 제공되어 내용 분석에 적합하지 않습니다",
    };
  }

  // 라이브 (duration 0 또는 제목/설명에 라이브 키워드)
  const liveKeywords = ["라이브", "생방송", "live", "streaming", "LIVE"];
  const isLive =
    durationSec === 0 ||
    liveKeywords.some(
      (kw) =>
        meta.title.toLowerCase().includes(kw.toLowerCase()) ||
        meta.description.toLowerCase().includes(kw.toLowerCase())
    );
  if (isLive && durationSec === 0) {
    return {
      type: "live",
      skipTranscript: true,
      sampleRatio: 0,
      reason: "라이브 방송은 자막이 없을 수 있습니다",
    };
  }

  // 긴 영상 (1시간 이상) — 자막 샘플링 강화
  if (durationSec >= LONG_VIDEO_THRESHOLD) {
    return {
      type: "long",
      skipTranscript: false,
      sampleRatio: 0.3,
      reason: "긴 영상은 자막을 30%만 샘플링합니다",
    };
  }

  // 일반 영상
  return {
    type: "normal",
    skipTranscript: false,
    sampleRatio: 1,
  };
}

export function getDurationSeconds(meta: VideoMetadata): number {
  return parseDuration(meta.duration);
}
