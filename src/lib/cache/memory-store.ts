import type { AnalysisResult } from "../types";

interface CacheEntry {
  result: AnalysisResult;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const TTL = 30 * 60 * 1000; // 30 minutes

export function getCached(videoId: string): AnalysisResult | null {
  const entry = cache.get(videoId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL) {
    cache.delete(videoId);
    return null;
  }
  return entry.result;
}

export function setCache(videoId: string, result: AnalysisResult): void {
  cache.set(videoId, { result, timestamp: Date.now() });
}

let analysisCounter = 0;

export function generateAnalysisId(): string {
  analysisCounter++;
  return `anl_${Date.now()}_${analysisCounter}`;
}
