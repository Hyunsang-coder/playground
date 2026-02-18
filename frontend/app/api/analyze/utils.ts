// Pure utility functions, fallback generators, and cache — ported from backend/analyzer.py

// --- Types used by the analyzer pipeline ---

export interface Competitor {
  title: string;
  url: string;
  snippet: string;
}

export interface GitHubRepo {
  name: string;
  description: string;
  stars: number;
  url: string;
  language: string;
  updated: string;
}

export interface WebSearchResult {
  competitors: Competitor[];
  raw_count: number;
  summary: string;
}

export interface GitHubSearchResult {
  repos: GitHubRepo[];
  total_count: number;
  summary: string;
}

export interface FeasibilityResult {
  overall_feasibility: string;
  score: number;
  vibe_coding_difficulty?: string;
  bottlenecks?: string[];
  tech_requirements: { name: string; available: boolean; difficulty: string; note: string }[];
  key_risks: string[];
  time_estimate: string;
  summary: string;
}

export interface DifferentiationResult {
  competition_level: string;
  competition_score: number;
  existing_solutions: { name: string; similarity: number; weakness: string }[];
  unique_angles: string[];
  devil_arguments: string[];
  pivot_suggestions: string[];
  summary: string;
}

export interface VerdictResult {
  verdict: string;
  confidence: number;
  overall_score: number;
  scores: { competition: number; feasibility: number; differentiation: number; timing: number };
  one_liner: string;
  recommendation: string;
  alternative_ideas: string[];
}

export interface SSEEvent {
  event: string;
  data: Record<string, unknown>;
}

// --- JSON parser (3-stage attempt + fallback) ---

export function parseJsonSafe<T>(text: string, fallback: T): T {
  // Try direct parse
  try {
    return JSON.parse(text);
  } catch {
    // continue
  }
  // Try extracting from markdown code block
  if (text.includes("```")) {
    try {
      let jsonStr = text.split("```")[1];
      if (jsonStr.startsWith("json")) {
        jsonStr = jsonStr.slice(4);
      }
      return JSON.parse(jsonStr.trim());
    } catch {
      // continue
    }
  }
  // Try finding first { to last }
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}") + 1;
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end));
    }
  } catch {
    // continue
  }
  return fallback;
}

// --- Fallback generators ---

export function fallbackFeasibility(): FeasibilityResult {
  return {
    overall_feasibility: "partial",
    score: 50,
    vibe_coding_difficulty: "medium",
    bottlenecks: ["LLM 분석 실패 — fallback 데이터입니다"],
    tech_requirements: [],
    key_risks: ["LLM 분석 실패 — fallback 데이터입니다"],
    time_estimate: "알 수 없음",
    summary: "AI 분석을 수행하지 못했습니다. API 키를 확인하세요.",
  };
}

export function fallbackDifferentiation(
  competitors: WebSearchResult,
  githubResults: GitHubSearchResult
): DifferentiationResult {
  const compCount = (competitors.raw_count || 0) + (githubResults.total_count || 0);
  const level = compCount > 20 ? "red_ocean" : compCount > 5 ? "moderate" : "blue_ocean";
  return {
    competition_level: level,
    competition_score: Math.max(0, 100 - compCount * 5),
    existing_solutions: [],
    unique_angles: [],
    devil_arguments: ["AI 분석 없이는 구체적 약점을 파악할 수 없습니다"],
    pivot_suggestions: [],
    summary: `경쟁 제품 ${compCount}개 기반 자동 판정`,
  };
}

export function fallbackVerdict(
  feasibility: FeasibilityResult,
  differentiation: DifferentiationResult
): VerdictResult {
  const fScore = feasibility.score ?? 50;
  const dScore = differentiation.competition_score ?? 50;
  const avg = Math.floor((fScore + dScore) / 2);
  const verdict = avg >= 70 ? "GO" : avg >= 40 ? "PIVOT" : "KILL";
  return {
    verdict,
    confidence: 40,
    overall_score: avg,
    scores: {
      competition: dScore,
      feasibility: fScore,
      differentiation: dScore,
      timing: 50,
    },
    one_liner: "AI 분석 없이 점수 기반 자동 판정입니다.",
    recommendation: "API 키를 설정하면 더 정확한 분석을 받을 수 있습니다.",
    alternative_ideas: [],
  };
}

// --- In-memory TTL cache (10 min) ---

const CACHE_TTL = 600_000; // 10 minutes in ms
const searchCache = new Map<string, { timestamp: number; result: unknown }>();

export function cacheGet<T>(key: string): T | null {
  const entry = searchCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.result as T;
  }
  if (entry) {
    searchCache.delete(key);
  }
  return null;
}

export function cacheSet(key: string, result: unknown): void {
  searchCache.set(key, { timestamp: Date.now(), result });
}

// --- Sleep helper ---

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
