import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  parseJsonSafe,
  fallbackFeasibility,
  fallbackDifferentiation,
  fallbackVerdict,
  cacheGet,
  cacheSet,
} from "../../app/api/analyze/utils";
import type {
  WebSearchResult,
  GitHubSearchResult,
  FeasibilityResult,
  DifferentiationResult,
  Bottleneck,
} from "../../app/api/analyze/utils";

// ─── parseJsonSafe ───────────────────────────────────────────────

describe("parseJsonSafe", () => {
  it("parses valid JSON directly", () => {
    const result = parseJsonSafe('{"key":"value"}', null);
    expect(result).toEqual({ key: "value" });
  });

  it("extracts JSON from markdown code block (```json ... ```)", () => {
    const text = '```json\n{"key":"value"}\n```';
    const result = parseJsonSafe(text, null);
    expect(result).toEqual({ key: "value" });
  });

  it("extracts JSON from plain markdown code block (``` ... ```)", () => {
    const text = '```\n{"key":"value"}\n```';
    const result = parseJsonSafe(text, null);
    expect(result).toEqual({ key: "value" });
  });

  it("extracts JSON by finding first { to last }", () => {
    const text = 'Some prefix text {"key":"value"} trailing text';
    const result = parseJsonSafe(text, null);
    expect(result).toEqual({ key: "value" });
  });

  it("returns fallback when all parsing fails", () => {
    const fallback = { default: true };
    const result = parseJsonSafe("not json at all", fallback);
    expect(result).toEqual(fallback);
  });

  it("returns fallback for empty string", () => {
    const fallback = { default: true };
    const result = parseJsonSafe("", fallback);
    expect(result).toEqual(fallback);
  });
});

// ─── fallbackFeasibility ─────────────────────────────────────────

describe("fallbackFeasibility", () => {
  it("returns score 50 and partial feasibility", () => {
    const result = fallbackFeasibility();
    expect(result.score).toBe(50);
    expect(result.overall_feasibility).toBe("partial");
  });

  it("returns required shape fields", () => {
    const result = fallbackFeasibility();
    expect(Array.isArray(result.tech_requirements)).toBe(true);
    expect(Array.isArray(result.key_risks)).toBe(true);
    expect(typeof result.time_estimate).toBe("string");
    expect(typeof result.summary).toBe("string");
  });
});

// ─── fallbackDifferentiation ─────────────────────────────────────

function makeWebResult(rawCount: number, competitorCount = 0): WebSearchResult {
  return {
    competitors: Array.from({ length: competitorCount }, (_, i) => ({
      title: `Competitor ${i}`,
      url: `https://example.com/${i}`,
      snippet: "snippet",
    })),
    raw_count: rawCount,
    summary: "",
  };
}

function makeGitHubResult(repoCount: number): GitHubSearchResult {
  return {
    repos: Array.from({ length: repoCount }, (_, i) => ({
      name: `repo-${i}`,
      description: "",
      stars: 0,
      url: `https://github.com/repo-${i}`,
      language: "TypeScript",
      updated: "2024-01-01",
    })),
    total_count: repoCount,
    summary: "",
  };
}

describe("fallbackDifferentiation", () => {
  it("returns blue_ocean with 0 signals (compCount=0)", () => {
    const result = fallbackDifferentiation(makeWebResult(0), makeGitHubResult(0));
    expect(result.competition_level).toBe("blue_ocean");
    expect(result.competition_score).toBeGreaterThanOrEqual(70);
    expect(result.competition_score).toBeLessThanOrEqual(100);
  });

  it("returns moderate with 5 total signals", () => {
    // webSignalCount=3 (raw_count=3) + github=2 → total=5 → moderate (>4 but ≤12)
    const result = fallbackDifferentiation(makeWebResult(3), makeGitHubResult(2));
    expect(result.competition_level).toBe("moderate");
    expect(result.competition_score).toBeGreaterThanOrEqual(40);
    expect(result.competition_score).toBeLessThanOrEqual(69);
  });

  it("returns red_ocean with 13 total signals", () => {
    // webSignalCount=8 + github=5 → total=13 → red_ocean (>12)
    const result = fallbackDifferentiation(makeWebResult(8), makeGitHubResult(5));
    expect(result.competition_level).toBe("red_ocean");
    expect(result.competition_score).toBeGreaterThanOrEqual(0);
    expect(result.competition_score).toBeLessThanOrEqual(39);
  });

  it("score is clamped within level bounds for large competitor counts", () => {
    const result = fallbackDifferentiation(makeWebResult(50), makeGitHubResult(50));
    expect(result.competition_score).toBeGreaterThanOrEqual(0);
    expect(result.competition_score).toBeLessThanOrEqual(39);
  });

  it("includes competitor count in summary", () => {
    const result = fallbackDifferentiation(makeWebResult(3), makeGitHubResult(2));
    expect(result.summary).toContain("5");
  });
});

// ─── fallbackVerdict ─────────────────────────────────────────────

function makeFeasibility(score: number, bottlenecks: FeasibilityResult["bottlenecks"] = []): FeasibilityResult {
  return {
    overall_feasibility: "partial",
    score,
    bottlenecks,
    tech_requirements: [],
    key_risks: [],
    time_estimate: "",
    summary: "",
  };
}

function makeDifferentiation(competition_score: number): DifferentiationResult {
  return {
    competition_level: "moderate",
    competition_score,
    existing_solutions: [],
    unique_angles: [],
    is_exact_match_found: false,
    summary: "",
  };
}

describe("fallbackVerdict", () => {
  it("returns GO when avg >= 70", () => {
    // avg = (80 + 70) / 2 = 75
    const result = fallbackVerdict(makeFeasibility(80), makeDifferentiation(70));
    expect(result.verdict).toBe("GO");
    expect(result.overall_score).toBe(75);
  });

  it("returns PIVOT when avg >= 40 and < 70", () => {
    // avg = (50 + 50) / 2 = 50
    const result = fallbackVerdict(makeFeasibility(50), makeDifferentiation(50));
    expect(result.verdict).toBe("PIVOT");
    expect(result.overall_score).toBe(50);
  });

  it("returns KILL when avg < 40", () => {
    // avg = (20 + 30) / 2 = 25
    const result = fallbackVerdict(makeFeasibility(20), makeDifferentiation(30));
    expect(result.verdict).toBe("KILL");
    expect(result.overall_score).toBe(25);
  });

  it("demotes GO to PIVOT when high severity bottleneck exists", () => {
    const highBottleneck: Bottleneck = {
      type: "api_unavailable",
      description: "No API",
      severity: "high",
      suggestion: "Use scraping",
    };
    // avg = (80 + 70) / 2 = 75 → would be GO, but downgraded
    const result = fallbackVerdict(makeFeasibility(80, [highBottleneck]), makeDifferentiation(70));
    expect(result.verdict).toBe("PIVOT");
  });

  it("does not demote PIVOT even with high severity bottleneck", () => {
    const highBottleneck: Bottleneck = {
      type: "no_library",
      description: "No library",
      severity: "high",
      suggestion: "Build from scratch",
    };
    // avg = 50 → PIVOT, stays PIVOT
    const result = fallbackVerdict(makeFeasibility(50, [highBottleneck]), makeDifferentiation(50));
    expect(result.verdict).toBe("PIVOT");
  });

  it("includes expected score structure", () => {
    const result = fallbackVerdict(makeFeasibility(60), makeDifferentiation(60));
    expect(result.scores).toHaveProperty("competition");
    expect(result.scores).toHaveProperty("feasibility");
    expect(result.scores).toHaveProperty("differentiation");
    expect(result.scores).toHaveProperty("timing");
  });
});

// ─── cacheGet / cacheSet ─────────────────────────────────────────

describe("cacheGet / cacheSet", () => {
  it("returns null for cache miss", () => {
    const result = cacheGet("nonexistent-key-xyz");
    expect(result).toBeNull();
  });

  it("returns cached value on hit", () => {
    cacheSet("test-key-1", { data: "hello" });
    const result = cacheGet("test-key-1");
    expect(result).toEqual({ data: "hello" });
  });

  it("returns null after TTL expiry (mocked Date.now)", () => {
    const realNow = Date.now;
    const baseTime = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(baseTime);

    cacheSet("expiry-key", { data: "will expire" });

    // Advance time past TTL (600_000 ms)
    vi.spyOn(Date, "now").mockReturnValue(baseTime + 600_001);

    const result = cacheGet("expiry-key");
    expect(result).toBeNull();

    vi.spyOn(Date, "now").mockImplementation(realNow);
  });

  it("overwrites existing value with new cacheSet", () => {
    cacheSet("overwrite-key", "first");
    cacheSet("overwrite-key", "second");
    expect(cacheGet("overwrite-key")).toBe("second");
  });
});
