import { describe, it, expect } from "vitest";
import { evaluateDataSourceWithRules, selectNpmCandidate } from "../../app/api/analyze/rules";
import type { NpmSearchCandidate } from "../../app/api/analyze/rules";

// ─── evaluateDataSourceWithRules ─────────────────────────────────

describe("evaluateDataSourceWithRules", () => {
  it("detects official API from URL containing /api", () => {
    const result = evaluateDataSourceWithRules({
      urls: ["https://example.com/api/reference"],
      snippets: ["public api documentation available", "rest api reference"],
    });
    expect(result.has_official_api).toBe(true);
    expect(result.blocking).toBe(false);
  });

  it("detects official API from developer portal URL + text", () => {
    const result = evaluateDataSourceWithRules({
      urls: ["https://developers.example.com"],
      snippets: ["api docs available here", "get api key"],
    });
    expect(result.has_official_api).toBe(true);
    expect(result.evidence_url).toBe("https://developers.example.com");
  });

  it("marks as blocking when legal block patterns found", () => {
    const result = evaluateDataSourceWithRules({
      urls: ["https://example.com/terms"],
      snippets: ["No scraping is allowed on this site"],
    });
    expect(result.blocking).toBe(true);
    expect(result.crawlable).toBe(false);
  });

  it("marks as blocking when robotsDisallowAll is true", () => {
    const result = evaluateDataSourceWithRules({
      urls: ["https://example.com"],
      snippets: [],
      robotsDisallowAll: true,
      robotsCheckedDomain: "example.com",
    });
    expect(result.blocking).toBe(true);
    expect(result.crawlable).toBe(false);
  });

  it("marks as crawlable when no API and no legal blocks but URLs present", () => {
    const result = evaluateDataSourceWithRules({
      urls: ["https://example.com/data"],
      snippets: ["some data available here"],
    });
    expect(result.has_official_api).toBe(false);
    expect(result.crawlable).toBe(true);
    expect(result.blocking).toBe(false);
  });

  it("returns blocking when no URLs, no snippets, no API signals", () => {
    const result = evaluateDataSourceWithRules({
      urls: [],
      snippets: [],
    });
    expect(result.has_official_api).toBe(false);
    expect(result.crawlable).toBe(false);
    expect(result.blocking).toBe(true);
  });

  it("API positive patterns do not fire when negative patterns cancel them", () => {
    const result = evaluateDataSourceWithRules({
      urls: ["https://developers.example.com"],
      snippets: ["api docs available but no api for external use", "private api only"],
    });
    // negative hits cancel positive → no official API
    expect(result.has_official_api).toBe(false);
  });

  it("includes evidence_url preferring API URL", () => {
    const result = evaluateDataSourceWithRules({
      urls: ["https://example.com/page", "https://example.com/api/v1"],
      snippets: ["rest api reference available", "api documentation here"],
    });
    expect(result.has_official_api).toBe(true);
    expect(result.evidence_url).toBe("https://example.com/api/v1");
  });
});

// ─── selectNpmCandidate ──────────────────────────────────────────

function makeCandidate(name: string, description = "", keywords: string[] = [], score = 0.8): NpmSearchCandidate {
  return { name, description, keywords, score };
}

describe("selectNpmCandidate", () => {
  it("returns not confident when no candidates", () => {
    const result = selectNpmCandidate("some-query", []);
    expect(result.confident).toBe(false);
    expect(result.package_name).toBeUndefined();
  });

  it("returns confident true for exact name match", () => {
    const result = selectNpmCandidate("axios", [makeCandidate("axios", "HTTP client", ["http", "ajax"])]);
    expect(result.confident).toBe(true);
    expect(result.package_name).toBe("axios");
  });

  it("returns not confident for single-token query with low npm score", () => {
    // Single meaningful token "lodash" → requiredScore = 0.7
    const result = selectNpmCandidate("lodash", [
      makeCandidate("lodash-extras", "extras", [], 0.3), // score < 0.7, no exact match
    ]);
    expect(result.confident).toBe(false);
  });

  it("returns confident for multi-token query with score >= 0.5 and sufficient overlap", () => {
    // Query tokens from "stripe payment sdk" → ["stripe", "payment"] (sdk is stop word)
    // Candidate has both tokens in name/description
    const result = selectNpmCandidate("stripe payment sdk", [
      makeCandidate("stripe", "stripe payment processing", ["payment", "billing"], 0.9),
    ]);
    expect(result.confident).toBe(true);
    expect(result.package_name).toBe("stripe");
  });

  it("selects the highest scoring candidate from multiple options", () => {
    const candidates = [
      makeCandidate("unrelated-pkg", "something else", [], 0.1),
      makeCandidate("axios", "HTTP client for node", ["http", "request"], 0.95),
      makeCandidate("superagent", "HTTP client library", ["http"], 0.6),
    ];
    const result = selectNpmCandidate("axios", candidates);
    expect(result.package_name).toBe("axios");
    expect(result.confident).toBe(true);
  });

  it("filters out candidates with empty names", () => {
    const result = selectNpmCandidate("test", [
      makeCandidate("", "empty name candidate", [], 1.0),
      makeCandidate("   ", "whitespace name", [], 1.0),
    ]);
    expect(result.confident).toBe(false);
    expect(result.package_name).toBeUndefined();
  });
});
