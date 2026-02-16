import { google } from "googleapis";
import type { SearchResultItem } from "../types";

const youtube = google.youtube("v3");

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  return key;
}

/** YouTube Search API로 검색 → videos.list batch로 상세 정보 보강 */
export async function searchVideos(
  query: string,
  maxResults = 5
): Promise<SearchResultItem[]> {
  // 1단계: 검색
  const searchRes = await youtube.search.list({
    key: getApiKey(),
    part: ["snippet"],
    q: query,
    type: ["video"],
    maxResults,
    relevanceLanguage: "ko",
    regionCode: "KR",
  });

  const items = searchRes.data.items ?? [];
  if (items.length === 0) return [];

  const videoIds = items
    .map((item) => item.id?.videoId)
    .filter((id): id is string => !!id);

  if (videoIds.length === 0) return [];

  // 2단계: videos.list batch 호출로 duration, viewCount, likeCount 가져오기
  const detailRes = await youtube.videos.list({
    key: getApiKey(),
    part: ["contentDetails", "statistics"],
    id: videoIds,
  });

  const detailMap = new Map<
    string,
    { duration: string; viewCount: number; likeCount: number }
  >();
  for (const detail of detailRes.data.items ?? []) {
    if (detail.id) {
      detailMap.set(detail.id, {
        duration: detail.contentDetails?.duration ?? "PT0S",
        viewCount: Number(detail.statistics?.viewCount ?? 0),
        likeCount: Number(detail.statistics?.likeCount ?? 0),
      });
    }
  }

  return items
    .filter((item) => item.id?.videoId)
    .map((item) => {
      const videoId = item.id!.videoId!;
      const snippet = item.snippet!;
      const detail = detailMap.get(videoId);

      return {
        videoId,
        title: decodeHtmlEntities(snippet.title ?? ""),
        channelName: snippet.channelTitle ?? "",
        channelId: snippet.channelId ?? "",
        thumbnailUrl:
          snippet.thumbnails?.high?.url ??
          snippet.thumbnails?.medium?.url ??
          "",
        publishedAt: snippet.publishedAt ?? "",
        description: snippet.description ?? "",
        duration: detail?.duration ?? "PT0S",
        viewCount: detail?.viewCount ?? 0,
        likeCount: detail?.likeCount ?? 0,
        analysisStatus: "pending" as const,
      };
    });
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
