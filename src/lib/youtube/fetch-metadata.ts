import { google } from "googleapis";
import type { VideoMetadata, VideoComment } from "../types";

const youtube = google.youtube("v3");

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  return key;
}

export async function fetchMetadata(videoId: string): Promise<VideoMetadata> {
  const res = await youtube.videos.list({
    key: getApiKey(),
    part: ["snippet", "statistics", "contentDetails"],
    id: [videoId],
  });

  const item = res.data.items?.[0];
  if (!item) throw new Error(`Video not found: ${videoId}`);

  const snippet = item.snippet!;
  const stats = item.statistics!;
  const content = item.contentDetails!;

  return {
    videoId,
    title: snippet.title ?? "",
    description: snippet.description ?? "",
    channelName: snippet.channelTitle ?? "",
    channelId: snippet.channelId ?? "",
    publishedAt: snippet.publishedAt ?? "",
    viewCount: Number(stats.viewCount ?? 0),
    likeCount: Number(stats.likeCount ?? 0),
    commentCount: Number(stats.commentCount ?? 0),
    duration: content.duration ?? "PT0S",
    thumbnailUrl:
      snippet.thumbnails?.maxres?.url ??
      snippet.thumbnails?.high?.url ??
      snippet.thumbnails?.medium?.url ??
      "",
    tags: snippet.tags ?? [],
    categoryId: snippet.categoryId ?? "",
  };
}

export async function fetchComments(
  videoId: string,
  maxResults = 100
): Promise<VideoComment[]> {
  try {
    const res = await youtube.commentThreads.list({
      key: getApiKey(),
      part: ["snippet"],
      videoId,
      maxResults: Math.min(maxResults, 100),
      order: "relevance",
      textFormat: "plainText",
    });

    return (res.data.items ?? []).map((item) => {
      const comment = item.snippet!.topLevelComment!.snippet!;
      return {
        text: comment.textDisplay ?? "",
        likeCount: comment.likeCount ?? 0,
        publishedAt: comment.publishedAt ?? "",
        isAuthorReply: false,
      };
    });
  } catch {
    // Comments disabled or unavailable
    return [];
  }
}
