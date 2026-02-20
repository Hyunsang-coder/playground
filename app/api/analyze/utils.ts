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
  github_repos?: GitHubRepo[]; // Merged Step 1 result
  raw_count: number;
  summary: string;
}

export interface GitHubSearchResult {
  repos: GitHubRepo[];
  total_count: number;
  summary: string;
}

export interface DataSource {
  name: string;
  has_official_api: boolean;
  crawlable: boolean;
  evidence_url?: string;
  blocking: boolean;
  note: string;
}

export interface LibraryCheck {
  name: string;
  available_on_npm: boolean;
  package_name?: string;
  note: string;
}

export interface DataAvailabilityResult {
  data_sources: DataSource[];
  libraries: LibraryCheck[];
  has_blocking_issues: boolean;
}

export type BottleneckType =
  | "api_unavailable"
  | "auth_complexity"
  | "data_structure_unknown"
  | "realtime_required"
  | "no_library"
  | "complex_algorithm"
  | "binary_processing";

export interface Bottleneck {
  type: BottleneckType;
  description: string;
  severity: "high" | "medium";
  suggestion: string;
}

export interface FeasibilityResult {
  overall_feasibility: string;
  score: number;
  vibe_coding_difficulty?: string;
  bottlenecks?: (string | Bottleneck)[];
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
  is_exact_match_found: boolean;
  summary: string;
}

export interface VerdictResult {
  verdict: string;
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

export function fallbackDataAvailability(): DataAvailabilityResult {
  return { data_sources: [], libraries: [], has_blocking_issues: false };
}

export function fallbackDifferentiation(
  competitors: WebSearchResult,
  githubResults: GitHubSearchResult
): DifferentiationResult {
  const webSignalCount = competitors.raw_count || competitors.competitors.length || 0;
  const githubSignalCount = githubResults.repos.length || 0;
  const compCount = webSignalCount + githubSignalCount;
  // competition_score: 높을수록 경쟁 적음 (유리). level과 범위 일치 필수.
  // blue_ocean: 70~100 / moderate: 40~69 / red_ocean: 0~39
  const level = compCount > 12 ? "red_ocean" : compCount > 4 ? "moderate" : "blue_ocean";
  const rawScore = Math.max(0, 100 - compCount * 7);
  const competition_score =
    level === "red_ocean" ? Math.min(rawScore, 39) :
    level === "moderate"  ? Math.min(Math.max(rawScore, 40), 69) :
                            Math.max(rawScore, 70);
  return {
    competition_level: level,
    competition_score,
    existing_solutions: [],
    unique_angles: [],
    is_exact_match_found: false,
    summary: `유의미 경쟁 신호 ${compCount}개(웹 ${webSignalCount}, GitHub ${githubSignalCount}) 기반 자동 판정`,
  };
}

export function fallbackVerdict(
  feasibility: FeasibilityResult,
  differentiation: DifferentiationResult
): VerdictResult {
  const fScore = feasibility.score ?? 50;
  const dScore = differentiation.competition_score ?? 50;
  const avg = Math.floor((fScore + dScore) / 2);

  const highSeverityCount = (feasibility.bottlenecks || []).filter(
    (b): b is Bottleneck => typeof b === "object" && b !== null && (b as Bottleneck).severity === "high"
  ).length;

  // high severity bottleneck이 있으면 GO 차단: PIVOT으로 강등
  const rawVerdict = avg >= 70 ? "GO" : avg >= 40 ? "PIVOT" : "KILL";
  const verdict = rawVerdict === "GO" && highSeverityCount >= 1 ? "PIVOT" : rawVerdict;

  return {
    verdict,
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
const MAX_CACHE_SIZE = 100;
const searchCache = new Map<string, { timestamp: number; result: unknown }>();

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of searchCache) {
    if (now - entry.timestamp >= CACHE_TTL) {
      searchCache.delete(key);
    }
  }
}

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
  if (searchCache.size >= MAX_CACHE_SIZE) {
    evictExpired();
  }
  // If still full after eviction, drop oldest entry
  if (searchCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey !== undefined) searchCache.delete(oldestKey);
  }
  searchCache.set(key, { timestamp: Date.now(), result });
}

// --- Sleep helper ---

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
