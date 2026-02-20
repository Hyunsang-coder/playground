// IdeaAnalyzer class — 3-step analysis pipeline, ported from backend/analyzer.py
// Uses Vercel AI SDK (@ai-sdk/anthropic + ai) instead of anthropic Python SDK

import { generateText, streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  parseJsonSafe,
  fallbackFeasibility,
  fallbackDifferentiation,
  fallbackVerdict,
  fallbackDataAvailability,
  cacheGet,
  cacheSet,
  type SSEEvent,
  type Competitor,
  type WebSearchResult,
  type GitHubSearchResult,
  type FeasibilityResult,
  type DifferentiationResult,
  type DataAvailabilityResult,
  type GitHubRepo,
} from "./utils";
import {
  buildSearchQueriesPrompt,
  buildRefineSearchQueriesPrompt,
  buildFilterRelevantPrompt,
  buildDataExtractionPrompt,
  buildDataJudgmentPrompt,
  buildFeasibilityPrompt,
  buildDifferentiationPrompt,
  buildVerdictPrompt,
} from "./prompts";
import {
  selectNpmCandidate,
  type NpmSearchCandidate,
} from "./rules";

type ClaudeStreamEvent =
  | { type: "progress"; text: string }
  | { type: "result"; result: Record<string, unknown> };

type SearchEvidence = { urls: string[]; snippets: string[] };
type NpmSearchResponse = {
  objects?: Array<{
    package?: {
      name?: string;
      description?: string;
      keywords?: string[];
    };
    score?: {
      final?: number;
    };
  }>;
};
type RobotsCheckResult = { disallowAll: boolean; domain?: string };
type TokenUsageMetrics = { promptTokens?: number; completionTokens?: number };

export class IdeaAnalyzer {
  private readonly dataAvailabilityCacheTtlMs = 1_800_000; // 30 minutes
  private readonly maxLocalCacheSize = 100;

  private anthropicApiKey: string;
  private tavilyApiKey: string;
  private githubToken: string;
  private dataAvailabilityCache = new Map<string, { timestamp: number; result: DataAvailabilityResult }>();

  constructor(anthropicApiKey: string, tavilyApiKey: string, githubToken: string = "") {
    this.anthropicApiKey = anthropicApiKey;
    this.tavilyApiKey = tavilyApiKey;
    this.githubToken = githubToken;
  }

  private normalizeQuery(query: string): string {
    return query.toLowerCase().replace(/\s+/g, " ").trim();
  }

  private formatTokenUsage(usage: unknown): { prompt: number | string; completion: number | string } {
    if (!usage || typeof usage !== "object") {
      return { prompt: "N/A", completion: "N/A" };
    }
    const metrics = usage as TokenUsageMetrics;
    return {
      prompt: typeof metrics.promptTokens === "number" ? metrics.promptTokens : "N/A",
      completion: typeof metrics.completionTokens === "number" ? metrics.completionTokens : "N/A",
    };
  }

  private buildCacheKey(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.map((part) => this.normalizeQuery(part)).join("|")}`;
  }

  private getDataAvailabilityCache(key: string): DataAvailabilityResult | null {
    const cached = this.dataAvailabilityCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp < this.dataAvailabilityCacheTtlMs) {
      return cached.result;
    }

    this.dataAvailabilityCache.delete(key);
    return null;
  }

  private setDataAvailabilityCache(key: string, result: DataAvailabilityResult): void {
    if (this.dataAvailabilityCache.size >= this.maxLocalCacheSize) {
      // Drop expired first
      for (const [cacheKey, entry] of this.dataAvailabilityCache) {
        if (Date.now() - entry.timestamp >= this.dataAvailabilityCacheTtlMs) {
          this.dataAvailabilityCache.delete(cacheKey);
        }
      }
    }
    if (this.dataAvailabilityCache.size >= this.maxLocalCacheSize) {
      const oldestKey = this.dataAvailabilityCache.keys().next().value;
      if (oldestKey !== undefined) this.dataAvailabilityCache.delete(oldestKey);
    }
    this.dataAvailabilityCache.set(key, { timestamp: Date.now(), result });
  }

  async *analyze(
    idea: string,
    enabledSteps: number[] = [1, 2, 3]
  ): AsyncGenerator<SSEEvent> {
    const activeSteps = enabledSteps.length > 0 ? enabledSteps : [1, 2, 3];
    const shouldRun = (step: number) => activeSteps.includes(step);
    const runStep1 = shouldRun(1);
    const runStep2 = shouldRun(2);
    const runStep3 = shouldRun(3);

    const searchQueries = runStep1
      ? await this.generateSearchQueries(idea)
      : { web_queries: [idea], github_queries: [idea] };

    // --- Step 1: Market Research & Differentiation (Web + GitHub) ---
    let competitors: WebSearchResult = {
      competitors: [],
      raw_count: 0,
      summary: "시장 조사 단계가 비활성화되었습니다.",
    };
    let githubResults: GitHubSearchResult = {
      repos: [],
      total_count: 0,
      summary: "시장 조사 단계가 비활성화되었습니다.",
    };
    let differentiation: DifferentiationResult = fallbackDifferentiation(competitors, githubResults);

    if (runStep1) {
      const webQueriesDisplay = (searchQueries.web_queries || [idea]).slice(0, 2).join(" / ");
      const ghQueriesDisplay = (searchQueries.github_queries || [idea]).slice(0, 2).join(" / ");

      yield {
        event: "step_start",
        data: {
          step: 1,
          title: "시장 및 차별화 분석",
          description: `웹(${webQueriesDisplay}) & GitHub(${ghQueriesDisplay}) 탐색 중...`,
        },
      };

      yield { event: "step_progress", data: { step: 1, text: "웹 및 GitHub를 병렬로 탐색하고 있습니다..." } };

      // Run searches in parallel
      const [webResult, ghResult] = await Promise.all([
        this.searchWeb(idea, searchQueries.web_queries || []),
        this.searchGithub(idea, searchQueries.github_queries || []),
      ]);

      competitors = webResult;
      githubResults = ghResult;

      yield { event: "step_progress", data: { step: 1, text: "발견된 경쟁 제품과 비교하여 차별화 분석을 스트리밍 중..." } };

      for await (const event of this.streamDifferentiation(idea, competitors, githubResults)) {
        if (event.type === "progress") {
          yield { event: "step_progress", data: { step: 1, text: `차별화 분석 스트리밍 중... (${event.text})` } };
        } else {
          differentiation = event.result as unknown as DifferentiationResult;
        }
      }

      // Merge results for UI
      const mergedResult = {
        web: {
          ...competitors,
          github_repos: githubResults.repos,
          summary: `웹 결과 ${competitors.raw_count}개, GitHub 저장소 ${githubResults.repos.length}개 발견.`
        },
        github: githubResults,
        differentiation: differentiation
      };

      yield { event: "step_result", data: { step: 1, result: mergedResult } };
    }

    // --- Step 2: Data Availability & Technical Feasibility ---
    const dataAvailability: DataAvailabilityResult = runStep2
      ? await this.checkDataAndLibraries(idea)
      : fallbackDataAvailability();

    let feasibility: FeasibilityResult = fallbackFeasibility();
    if (runStep2) {
      yield {
        event: "step_start",
        data: {
          step: 2,
          title: "기술 실현성 및 데이터 검증",
          description: "데이터 소스 가용성과 기술적 난이도를 심층 분석 중...",
        },
      };

      for await (const event of this.streamFeasibility(idea, dataAvailability)) {
        if (event.type === "progress") {
          yield { event: "step_progress", data: { step: 2, text: event.text } };
        } else {
          feasibility = event.result as unknown as FeasibilityResult;
        }
      }

      yield { event: "step_result", data: { step: 2, result: feasibility } };
    }

    // --- Step 3: Verdict ---
    if (runStep3) {
      yield {
        event: "step_start",
        data: {
          step: 3,
          title: "종합 판정",
          description: "최종 리포트를 생성하고 있습니다...",
        },
      };

      let verdict = fallbackVerdict(feasibility, differentiation);
      for await (const event of this.streamVerdict(
        idea,
        {
          enabledSteps: activeSteps,
          competitors: runStep1 ? competitors : undefined,
          githubResults: runStep1 ? githubResults : undefined,
          feasibility: runStep2 ? feasibility : undefined,
          differentiation: runStep1 ? differentiation : undefined,
          dataAvailability: runStep2 ? dataAvailability : undefined,
        }
      )) {
        if (event.type === "progress") {
          yield { event: "step_progress", data: { step: 3, text: event.text } };
        } else {
          verdict = event.result as unknown as typeof verdict;
        }
      }

      yield { event: "step_result", data: { step: 3, result: verdict } };
    }

    yield { event: "done", data: { message: "분석 완료" } };
  }

  // --- Pre-step: Generate search queries ---

  private async generateSearchQueries(idea: string): Promise<{ web_queries: string[]; github_queries: string[] }> {
    const fallback = {
      web_queries: [`${idea} tool service app`, `${idea} alternative competitor`],
      github_queries: [idea],
    };
    if (!this.anthropicApiKey) return fallback;

    try {
      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-6"),
        maxOutputTokens: 256,
        messages: [{ role: "user", content: buildSearchQueriesPrompt(idea) }],
      });
      const result = parseJsonSafe<{ web_queries?: string[]; github_queries?: string[]; github_query?: string }>(text.trim(), {});
      if (result.web_queries && (result.github_queries || result.github_query)) {
        return {
          web_queries: result.web_queries,
          // 구형 응답(github_query 단수)도 수용
          github_queries: result.github_queries ?? (result.github_query ? [result.github_query] : [idea]),
        };
      }
    } catch {
      // fall through
    }
    return fallback;
  }

  // --- Step 1: Web search ---

  private async searchWeb(idea: string, aiQueries: string[]): Promise<WebSearchResult> {
    if (!this.tavilyApiKey) {
      return { competitors: [], summary: "검색 API 키가 설정되지 않았습니다.", raw_count: 0 };
    }

    const query1 = aiQueries[0] || `${idea} tool service app`;
    const query2 = aiQueries[1] || `${idea} alternative competitor similar`;
    const cacheKey = this.buildCacheKey(
      "web",
      ...[query1, query2].map((q) => this.normalizeQuery(q)).sort()
    );
    const cached = cacheGet<WebSearchResult>(cacheKey);
    if (cached) return cached;

    try {
      // Phase 1: Parallel basic search
      let competitors = await this.doWebSearchParallel(query1, query2, "basic");

      // Phase 2: Refine if sparse
      if (competitors.length < 3) {
        const refinedQueries = await this.refineSearchQueries(idea, competitors);
        if (refinedQueries.length > 0) {
          const rq1 = refinedQueries[0] || query1;
          const rq2 = refinedQueries[1] || query2;
          const retryCompetitors = await this.doWebSearchParallel(rq1, rq2, "basic");
          const existingUrls = new Set(competitors.map((c) => c.url));
          for (const c of retryCompetitors) {
            if (!existingUrls.has(c.url)) {
              competitors.push(c);
              existingUrls.add(c.url);
            }
          }
        }
      }

      // Phase 3: Filter for relevance using Claude
      if (competitors.length > 0 && this.anthropicApiKey) {
        competitors = await this.filterRelevant(idea, competitors);
      }
      // Phase 4: Deterministic reranking to reduce noisy results
      competitors = this.rerankCompetitors(idea, competitors);

      const result: WebSearchResult = {
        competitors: competitors.slice(0, 10),
        raw_count: competitors.length,
        summary: `웹에서 ${competitors.length}개의 관련 결과를 발견했습니다.`,
      };
      cacheSet(cacheKey, result);
      return result;
    } catch (e) {
      return { competitors: [], summary: `검색 중 오류: ${e instanceof Error ? e.message : String(e)}`, raw_count: 0 };
    }
  }

  private async doWebSearchParallel(query1: string, query2: string, depth: string): Promise<Competitor[]> {
    const timeout = depth === "advanced" ? 25000 : 15000;

    try {
      const [resp1, resp2] = await Promise.all([
        fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: this.tavilyApiKey,
            query: query1,
            max_results: 8,
            search_depth: depth,
            include_raw_content: true,
          }),
          signal: AbortSignal.timeout(timeout),
        }),
        fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: this.tavilyApiKey,
            query: query2,
            max_results: 5,
            search_depth: depth,
            include_raw_content: true,
          }),
          signal: AbortSignal.timeout(timeout),
        }),
      ]);

      const competitors: Competitor[] = [];
      const seenUrls = new Set<string>();

      for (const resp of [resp1, resp2]) {
        if (!resp.ok) continue;
        const data = await resp.json();
        for (const r of data.results || []) {
          const url = r.url || "";
          if (url && !seenUrls.has(url)) {
            seenUrls.add(url);
            const raw = r.raw_content || r.content || "";
            competitors.push({
              title: r.title || "",
              url,
              snippet: raw.slice(0, 500),
            });
          }
        }
      }

      return competitors;
    } catch {
      return [];
    }
  }

  private async refineSearchQueries(idea: string, currentResults: Competitor[]): Promise<string[]> {
    if (!this.anthropicApiKey) return [];

    try {
      const { text } = await generateText({
        model: anthropic("claude-haiku-4-5-20251001"),
        maxOutputTokens: 128,
        messages: [{ role: "user", content: buildRefineSearchQueriesPrompt(idea, currentResults) }],
      });
      const result = parseJsonSafe<{ queries?: string[] }>(text.trim(), {});
      return result.queries || [];
    } catch {
      return [];
    }
  }

  private async filterRelevant(idea: string, competitors: Competitor[]): Promise<Competitor[]> {
    if (!competitors.length) return [];

    try {
      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-6"),
        maxOutputTokens: 128,
        messages: [{ role: "user", content: buildFilterRelevantPrompt(idea, competitors) }],
      });
      const result = parseJsonSafe<{ relevant_indices?: number[] }>(text.trim(), {});
      const indices = result.relevant_indices || competitors.map((_, i) => i);
      return indices
        .filter((i): i is number => typeof i === "number" && i >= 0 && i < competitors.length)
        .map((i) => competitors[i]);
    } catch {
      return competitors;
    }
  }

  private rerankCompetitors(idea: string, competitors: Competitor[]): Competitor[] {
    if (competitors.length <= 1) return competitors;

    const ideaTokens = this.normalizeQuery(idea)
      .split(" ")
      .filter((token) => token.length >= 3)
      .slice(0, 8);

    const positivePatterns = [
      "app",
      "tool",
      "software",
      "platform",
      "product",
      "service",
      "saas",
      "pricing",
      "alternative",
      "competitor",
    ];
    const noisyPatterns = [
      "blog",
      "tutorial",
      "guide",
      "how to",
      "news",
      "press release",
      "reddit",
      "quora",
      "youtube",
      "linkedin",
      "tistory",
      "velog",
    ];
    const trustedDomainPatterns = [
      "github.com",
      "producthunt.com",
      "g2.com",
      "capterra.com",
      "crunchbase.com",
    ];
    const noisyDomainPatterns = [
      "medium.com",
      "dev.to",
      "blog.",
      "news.",
      "youtube.com",
    ];

    const scored = competitors.map((competitor, index) => {
      const text = this.normalizeQuery(`${competitor.title} ${competitor.snippet}`);
      const domain = this.extractDomain(competitor.url);
      let score = 0;

      for (const token of ideaTokens) {
        if (text.includes(token)) score += 3;
      }
      for (const keyword of positivePatterns) {
        if (text.includes(keyword)) score += 1;
      }
      for (const keyword of noisyPatterns) {
        if (text.includes(keyword)) score -= 2;
      }
      for (const pattern of trustedDomainPatterns) {
        if (domain.includes(pattern)) score += 3;
      }
      for (const pattern of noisyDomainPatterns) {
        if (domain.includes(pattern)) score -= 2;
      }

      return { competitor, index, score };
    });

    // Keep deterministic order for ties to reduce UI flicker between runs.
    return scored
      .sort((a, b) => (b.score - a.score) || (a.index - b.index))
      .map((item) => item.competitor);
  }

  private extractDomain(rawUrl: string): string {
    try {
      return new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
  }

  // --- Step 1: GitHub search ---

  private async searchGithub(idea: string, aiQueries: string[]): Promise<GitHubSearchResult> {
    const primaryQuery = (aiQueries[0] || idea).trim().replace(/\s+/g, " ");
    const secondaryQuery = (aiQueries[1] || "").trim().replace(/\s+/g, " ");

    const cacheKey = this.buildCacheKey("github", primaryQuery, secondaryQuery);
    const cached = cacheGet<GitHubSearchResult>(cacheKey);
    if (cached) return cached;

    const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
    if (this.githubToken) {
      headers.Authorization = `token ${this.githubToken}`;
    }

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const pushedAfter = twoYearsAgo.toISOString().slice(0, 10);

    // 단계적으로 조건을 완화하며 최대한 결과를 확보하는 검색 전략
    const searchPlans: Array<{ query: string; minStars: number; withDateFilter: boolean }> = [
      // 1차: 기본 쿼리, 엄격한 조건
      { query: primaryQuery, minStars: 50, withDateFilter: true },
      // 2차: 기본 쿼리, 날짜 조건 제거 (오래된 프로젝트도 포함)
      { query: primaryQuery, minStars: 10, withDateFilter: false },
      // 3차: 보조 쿼리 (더 넓은 카테고리), 관대한 조건
      ...(secondaryQuery ? [{ query: secondaryQuery, minStars: 10, withDateFilter: false }] : []),
    ];

    const seenRepos = new Set<string>();
    const collectedRepos: GitHubRepo[] = [];
    let totalCount = 0;

    try {
      for (const plan of searchPlans) {
        if (collectedRepos.length >= 5) break; // 충분히 모이면 조기 종료

        const qualifiers = [
          `stars:>=${plan.minStars}`,
          plan.withDateFilter ? `pushed:>=${pushedAfter}` : "",
          "archived:false",
        ].filter(Boolean).join(" ");

        const fullQuery = `${plan.query} ${qualifiers}`;
        const encodedQuery = encodeURIComponent(fullQuery);

        let resp: Response;
        try {
          resp = await fetch(
            `https://api.github.com/search/repositories?q=${encodedQuery}&sort=stars&order=desc&per_page=10`,
            { headers, signal: AbortSignal.timeout(15000) }
          );
        } catch {
          continue; // 네트워크 오류는 다음 plan으로
        }

        if (!resp.ok) {
          // 422 = 쿼리 문법 오류, 403 = rate limit — 다음 plan 시도
          console.warn(`[GitHub search] HTTP ${resp.status} for query: ${fullQuery}`);
          continue;
        }

        const data = await resp.json() as { items?: Record<string, unknown>[]; total_count?: number };
        if (data.total_count && data.total_count > totalCount) totalCount = data.total_count;

        for (const item of data.items || []) {
          const url = (item.html_url as string) || "";
          if (!url || seenRepos.has(url)) continue;
          seenRepos.add(url);
          collectedRepos.push({
            name: (item.full_name as string) || "",
            description: ((item.description as string) || "").slice(0, 200),
            stars: (item.stargazers_count as number) || 0,
            url,
            language: (item.language as string) || "",
            updated: ((item.updated_at as string) || "").slice(0, 10),
          });
        }
      }

      // 별점 내림차순 정렬 후 상위 10개
      const repos = collectedRepos
        .sort((a, b) => b.stars - a.stars)
        .slice(0, 10);

      const result: GitHubSearchResult = {
        repos,
        total_count: totalCount,
        summary: `유의미한 GitHub 저장소 ${repos.length}개를 선별했습니다 (전체 검색 모수 ${totalCount}개).`,
      };

      cacheSet(cacheKey, result);
      return result;
    } catch (e) {
      return { repos: [], total_count: 0, summary: `GitHub 검색 중 오류: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  private async doDataAvailabilitySearch(
    queries: string[],
    maxQueries = 6
  ): Promise<Map<string, SearchEvidence>> {
    const limitedQueries = queries.slice(0, maxQueries);

    const results = await Promise.all(
      limitedQueries.map(async (query) => {
        if (!this.tavilyApiKey) {
          return [query, { urls: [], snippets: [] }] as [string, SearchEvidence];
        }

        try {
          const resp = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: this.tavilyApiKey,
              query,
              max_results: 3,
              search_depth: "basic",
            }),
            signal: AbortSignal.timeout(15000),
          });

          if (!resp.ok) {
            return [query, { urls: [], snippets: [] }] as [string, SearchEvidence];
          }

          const data = await resp.json() as {
            results?: Array<{ url?: string; content?: string; raw_content?: string }>;
          };

          const topResults = (data.results || []).slice(0, 3);
          const urls = topResults
            .map((r) => r.url || "")
            .filter((u): u is string => Boolean(u));
          const snippets = topResults
            .map((r) => (r.content || r.raw_content || "").trim().slice(0, 300))
            .filter((s): s is string => Boolean(s));

          return [query, { urls, snippets }] as [string, SearchEvidence];
        } catch {
          return [query, { urls: [], snippets: [] }] as [string, SearchEvidence];
        }
      })
    );

    return new Map(results);
  }

  private isRobotsDisallowAll(content: string): boolean {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.replace(/#.*/, "").trim().toLowerCase())
      .filter(Boolean);

    let appliesToStar = false;
    let sawStarGroup = false;
    let hasDisallowAll = false;
    let hasAllowRoot = false;

    for (const line of lines) {
      if (line.startsWith("user-agent:")) {
        const agent = line.slice("user-agent:".length).trim();
        appliesToStar = agent === "*";
        if (appliesToStar) sawStarGroup = true;
        continue;
      }

      if (!appliesToStar) continue;

      if (line.startsWith("disallow:")) {
        const value = line.slice("disallow:".length).trim();
        if (value === "/") hasDisallowAll = true;
        if (value === "") hasAllowRoot = true;
      } else if (line.startsWith("allow:")) {
        const value = line.slice("allow:".length).trim();
        if (value === "/" || value === "") hasAllowRoot = true;
      }
    }

    return sawStarGroup && hasDisallowAll && !hasAllowRoot;
  }

  private async checkRobotsPolicy(urls: string[]): Promise<RobotsCheckResult> {
    const domains = Array.from(
      new Set(
        urls
          .map((url) => this.extractDomain(url))
          .filter((domain) => domain.length > 0)
      )
    ).slice(0, 2);

    for (const domain of domains) {
      try {
        const resp = await fetch(`https://${domain}/robots.txt`, {
          signal: AbortSignal.timeout(6000),
        });
        if (!resp.ok) continue;
        const text = await resp.text();
        if (this.isRobotsDisallowAll(text)) {
          return { disallowAll: true, domain };
        }
      } catch {
        // ignore robots lookup failures
      }
    }

    return { disallowAll: false };
  }

  private looksLikeNpmPackageName(value: string): boolean {
    return /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i.test(value.trim());
  }

  private normalizeLibraryInput(raw: string): { query: string; isCategoryHint: boolean } {
    const trimmed = raw.trim().replace(/^npm[:\s]+/i, "");
    const categoryMatch = trimmed.match(/^category\s*:\s*(.+)$/i);
    if (categoryMatch) {
      return { query: categoryMatch[1].trim(), isCategoryHint: true };
    }
    return { query: trimmed, isCategoryHint: false };
  }

  private async checkNpmPackageExists(packageName: string): Promise<boolean> {
    if (!packageName || !this.looksLikeNpmPackageName(packageName)) return false;

    try {
      const resp = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  private async searchNpmCandidates(query: string): Promise<NpmSearchCandidate[]> {
    if (!query) return [];

    try {
      const resp = await fetch(
        `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=6`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!resp.ok) return [];

      const data = await resp.json() as NpmSearchResponse;
      return (data.objects || [])
        .map((item) => ({
          name: item.package?.name || "",
          description: item.package?.description || "",
          keywords: Array.isArray(item.package?.keywords) ? item.package?.keywords : [],
          score: item.score?.final || 0,
        }))
        .filter((item) => item.name.length > 0);
    } catch {
      return [];
    }
  }

  private async validateLibraryOnNpm(library: string): Promise<{
    name: string;
    available_on_npm: boolean;
    package_name?: string;
    note: string;
  }> {
    const { query, isCategoryHint } = this.normalizeLibraryInput(library);
    if (!query) {
      return {
        name: library || "Unknown library",
        available_on_npm: false,
        note: "빈 라이브러리 입력",
      };
    }

    if (this.looksLikeNpmPackageName(query)) {
      const exists = await this.checkNpmPackageExists(query);
      if (exists) {
        return {
          name: library,
          available_on_npm: true,
          package_name: query,
          note: `npm registry에서 ${query} 확인`,
        };
      }
    }

    const candidates = await this.searchNpmCandidates(query);
    const selection = selectNpmCandidate(query, candidates);

    if (selection.package_name && selection.confident) {
      const confirmed = await this.checkNpmPackageExists(selection.package_name);
      if (confirmed) {
        const inferredNote = isCategoryHint
          ? `${selection.note} (category 기반 추론)`
          : selection.note;
        return {
          name: library,
          available_on_npm: true,
          package_name: selection.package_name,
          note: inferredNote,
        };
      }
    }

    if (selection.package_name) {
      return {
        name: library,
        available_on_npm: false,
        package_name: selection.package_name,
        note: `${selection.note} (수동 확인 권장)`,
      };
    }

    return {
      name: library,
      available_on_npm: false,
      note: selection.note,
    };
  }

  private async verifyApiUrl(url: string): Promise<boolean> {
    if (!url) return false;
    try {
      const resp = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
        redirect: "follow",
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  private async getClaudeDataJudgment(
    dataSources: string[],
    libraries: string[],
    evidenceMap: Map<string, SearchEvidence>
  ): Promise<DataAvailabilityResult | null> {
    if (!this.anthropicApiKey || dataSources.length === 0) return null;

    try {
      const evidenceRecord: Record<string, { urls: string[]; snippets: string[] }> = {};
      for (const [query, ev] of evidenceMap) {
        // Trim evidence locally to save input tokens: only top 2 URLs and top 3 Snippets
        evidenceRecord[query] = {
          urls: ev.urls.slice(0, 2),
          snippets: ev.snippets.slice(0, 3)
        };
      }

      const prompt = buildDataJudgmentPrompt(dataSources, libraries, evidenceRecord);
      const { text, usage } = await generateText({
        model: anthropic("claude-sonnet-4-6"),
        maxOutputTokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const usageMetrics = this.formatTokenUsage(usage);
      console.log(`[Token Usage: getClaudeDataJudgment] IN: ${usageMetrics.prompt} | OUT: ${usageMetrics.completion}`);

      const parsed = parseJsonSafe<Partial<DataAvailabilityResult>>(text.trim(), {});
      if (!parsed || !Array.isArray(parsed.data_sources)) return null;

      return parsed as DataAvailabilityResult;
    } catch {
      return null;
    }
  }

  private async checkDataAndLibraries(idea: string): Promise<DataAvailabilityResult> {
    if (!this.anthropicApiKey) {
      return fallbackDataAvailability();
    }
    const cacheKey = this.buildCacheKey("data-availability", idea);
    const cached = this.getDataAvailabilityCache(cacheKey);
    if (cached) return cached;

    try {
      const extractionPrompt = buildDataExtractionPrompt(idea);
      const extractionFallback = { data_sources: [], libraries: [] };

      const { text: extractionText } = await generateText({
        model: anthropic("claude-sonnet-4-6"),
        maxOutputTokens: 512,
        messages: [{ role: "user", content: extractionPrompt }],
      });

      type ExtractedSource = { name: string; search_queries: string[] };
      const extracted = parseJsonSafe<{
        data_sources?: Array<ExtractedSource | string>;
        libraries?: string[];
      }>(extractionText.trim(), extractionFallback);

      // Parse data sources: support both new {name, search_queries} and legacy string formats
      const seen = new Set<string>();
      const parsedSources: ExtractedSource[] = (extracted.data_sources || [])
        .map((s): ExtractedSource | null => {
          if (typeof s === "string") return s.trim() ? { name: s.trim(), search_queries: [] } : null;
          if (s && typeof s === "object" && typeof s.name === "string" && s.name.trim()) {
            return {
              name: s.name.trim(),
              search_queries: Array.isArray(s.search_queries)
                ? s.search_queries.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
                : [],
            };
          }
          return null;
        })
        .filter((s): s is ExtractedSource => {
          if (!s || seen.has(s.name)) return false;
          seen.add(s.name);
          return true;
        })
        .slice(0, 3);

      const dataSources = parsedSources.map((s) => s.name);

      const libraries = Array.from(
        new Set((extracted.libraries || []).filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean))
      ).slice(0, 3);

      if (dataSources.length === 0 && libraries.length === 0) {
        const fallback = fallbackDataAvailability();
        this.setDataAvailabilityCache(cacheKey, fallback);
        return fallback;
      }

      const sourceQueriesByName = new Map<string, string[]>();
      const sourceQueries: string[] = [];
      for (const src of parsedSources) {
        const custom = src.search_queries.slice(0, 3);
        const queriesForSource = custom.length >= 2
          ? custom.slice(0, 2)
          : [
            `${src.name} official API documentation`,
            `${src.name} developer portal`,
          ];
        sourceQueriesByName.set(src.name, queriesForSource);
        sourceQueries.push(...queriesForSource);
      }

      const uniqueQueries = Array.from(new Set(sourceQueries));
      const evidenceMap = await this.doDataAvailabilitySearch(uniqueQueries, 6);

      // Single high-accuracy LLM validation + URL Check
      const [claudeJudgment, libraryResult] = await Promise.all([
        this.getClaudeDataJudgment(dataSources, libraries, evidenceMap),
        Promise.all(libraries.map((library) => this.validateLibraryOnNpm(library))),
      ]);

      const dataSourceResult = await Promise.all(
        dataSources.map(async (source) => {
          const judged = claudeJudgment?.data_sources.find((s) => s.name === source);

          if (!judged) {
            return {
              name: source,
              has_official_api: false,
              crawlable: false,
              blocking: true,
              note: "AI 검증 실패 (안전장치 발동)",
            };
          }

          // robots.txt and URL HEAD verification
          let finalNote = judged.note;
          let finalBlocking = judged.blocking;
          let finalHasApi = judged.has_official_api;

          if (judged.evidence_url) {
            const alive = await this.verifyApiUrl(judged.evidence_url);
            if (alive && finalHasApi) {
              finalNote = `${finalNote} (URL 검증 완료)`;
            } else if (!alive && finalHasApi) {
              finalHasApi = false;
              finalBlocking = !judged.crawlable;
              finalNote = `${finalNote} (근거 URL 접근 불가 — 수동 확인 필요)`;
            }

            if (judged.crawlable && !finalBlocking) {
              const robots = await this.checkRobotsPolicy([judged.evidence_url]);
              if (robots.disallowAll) {
                finalBlocking = true;
                finalNote = `${finalNote} (robots.txt 전면 차단 발견)`;
              }
            }
          }

          return {
            name: source,
            has_official_api: finalHasApi,
            crawlable: judged.crawlable,
            evidence_url: judged.evidence_url,
            blocking: finalBlocking,
            note: finalNote,
          };
        })
      );

      const hasBlockingIssues = dataSourceResult.some((source) => source.blocking);
      const result: DataAvailabilityResult = {
        data_sources: dataSourceResult,
        libraries: libraryResult,
        has_blocking_issues: hasBlockingIssues,
      };
      this.setDataAvailabilityCache(cacheKey, result);
      return result;
    } catch {
      const fallback = fallbackDataAvailability();
      this.setDataAvailabilityCache(cacheKey, fallback);
      return fallback;
    }
  }

  // --- Steps 3-5: Claude streaming ---

  private async *callClaudeStream(
    prompt: string,
    fallback: Record<string, unknown>
  ): AsyncGenerator<ClaudeStreamEvent> {
    if (!this.anthropicApiKey) {
      yield { type: "result", result: fallback };
      return;
    }

    try {
      let collectedText = "";
      let charCount = 0;

      const { textStream, usage } = streamText({
        model: anthropic("claude-sonnet-4-6"),
        maxOutputTokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });

      for await (const chunk of textStream) {
        collectedText += chunk;
        charCount += chunk.length;
        if (charCount >= 80) {
          charCount = 0;
          yield { type: "progress", text: `AI 응답 생성 중... (${collectedText.length}자)` };
        }
      }

      const finalUsage = await usage;
      if (finalUsage) {
        const usageMetrics = this.formatTokenUsage(finalUsage);
        console.log(`[Token Usage: Stream] IN: ${usageMetrics.prompt} | OUT: ${usageMetrics.completion}`);
      }

      const parsed = parseJsonSafe(collectedText.trim(), fallback);
      yield { type: "result", result: parsed };
    } catch {
      yield { type: "result", result: fallback };
    }
  }

  private async *streamFeasibility(
    idea: string,
    dataAvailability: DataAvailabilityResult
  ): AsyncGenerator<ClaudeStreamEvent> {
    const fallback = fallbackFeasibility();
    const prompt = buildFeasibilityPrompt(idea, dataAvailability);

    for await (const event of this.callClaudeStream(prompt, fallback as unknown as Record<string, unknown>)) {
      if (event.type === "result") {
        yield { type: "result", result: { ...event.result, data_availability: dataAvailability } };
      } else {
        yield event;
      }
    }
  }

  private async *streamDifferentiation(
    idea: string,
    competitors: WebSearchResult,
    githubResults: GitHubSearchResult
  ): AsyncGenerator<ClaudeStreamEvent> {
    const fallback = fallbackDifferentiation(competitors, githubResults);
    const prompt = buildDifferentiationPrompt(idea, competitors, githubResults);
    yield* this.callClaudeStream(prompt, fallback as unknown as Record<string, unknown>);
  }

  private async *streamVerdict(
    idea: string,
    context: {
      enabledSteps: number[];
      competitors?: WebSearchResult;
      githubResults?: GitHubSearchResult;
      feasibility?: FeasibilityResult;
      differentiation?: DifferentiationResult;
      dataAvailability?: DataAvailabilityResult;
    }
  ): AsyncGenerator<ClaudeStreamEvent> {
    const fallback = fallbackVerdict(
      context.feasibility || fallbackFeasibility(),
      context.differentiation || fallbackDifferentiation(
        context.competitors || { competitors: [], raw_count: 0, summary: "미선택" },
        context.githubResults || { repos: [], total_count: 0, summary: "미선택" }
      )
    )

    const prompt = buildVerdictPrompt(idea, context);
    yield* this.callClaudeStream(prompt, fallback as unknown as Record<string, unknown>);
  }


}
