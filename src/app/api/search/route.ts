import { NextResponse } from "next/server";
import { searchVideos } from "@/lib/youtube/search";
import {
  getSearchCached,
  setSearchCache,
} from "@/lib/cache/memory-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, maxResults } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: { code: "INVALID_QUERY", message: "검색어를 입력해주세요." } },
        { status: 400 }
      );
    }

    // 검색 캐시 확인
    const cached = getSearchCached(query);
    if (cached) {
      return NextResponse.json({ results: cached });
    }

    const results = await searchVideos(
      query.trim(),
      Math.min(maxResults ?? 5, 10)
    );

    // 캐시 저장
    setSearchCache(query, results);

    return NextResponse.json({ results });
  } catch (e) {
    console.error("Search failed:", e);
    return NextResponse.json(
      {
        error: {
          code: "SEARCH_FAILED",
          message: "검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        },
      },
      { status: 500 }
    );
  }
}
