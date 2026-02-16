import type { AnalysisResult, SearchResultItem } from "../types";

// === LRU Cache 구현 ===

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly ttl: number;

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    // LRU: 접근 시 순서 갱신
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    // 기존 키 삭제 (순서 갱신)
    this.cache.delete(key);
    // 크기 제한 초과 시 가장 오래된 항목 삭제
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  get size(): number {
    return this.cache.size;
  }
}

// === 분석 캐시 (30분, 최대 100개) ===

const analysisCache = new LRUCache<AnalysisResult>(100, 30 * 60 * 1000);

export function getCached(videoId: string): AnalysisResult | null {
  return analysisCache.get(videoId);
}

export function setCache(videoId: string, result: AnalysisResult): void {
  analysisCache.set(videoId, result);
}

// === 검색 캐시 (10분, 최대 50개) ===

const searchCache = new LRUCache<SearchResultItem[]>(50, 10 * 60 * 1000);

export function getSearchCached(query: string): SearchResultItem[] | null {
  return searchCache.get(normalizeQuery(query));
}

export function setSearchCache(query: string, results: SearchResultItem[]): void {
  searchCache.set(normalizeQuery(query), results);
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

// === Analysis ID 생성 ===

let analysisCounter = 0;

export function generateAnalysisId(): string {
  analysisCounter++;
  return `anl_${Date.now()}_${analysisCounter}`;
}
