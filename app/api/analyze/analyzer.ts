// IdeaAnalyzer class — 5-step analysis pipeline, ported from backend/analyzer.py
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
  sleep,
  type SSEEvent,
  type Competitor,
  type WebSearchResult,
  type GitHubSearchResult,
  type FeasibilityResult,
  type DifferentiationResult,
  type DataAvailabilityResult,
} from "./utils";
import {
  buildSearchQueriesPrompt,
  buildRefineSearchQueriesPrompt,
  buildFilterRelevantPrompt,
  buildDataExtractionPrompt,
  buildFeasibilityPrompt,
  buildDifferentiationPrompt,
  buildVerdictPrompt,
} from "./prompts";
import {
  evaluateDataSourceWithRules,
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
    enabledSteps: number[] = [1, 2, 3, 4, 5]
  ): AsyncGenerator<SSEEvent> {
    const activeSteps = enabledSteps.length > 0 ? enabledSteps : [1, 2, 3, 4, 5];
    const shouldRun = (step: number) => activeSteps.includes(step);
    const runStep1 = shouldRun(1);
    const runStep2 = shouldRun(2);
    const runStep3 = shouldRun(3);
    const runStep4 = shouldRun(4);
    const runStep5 = shouldRun(5);

    const searchQueries = runStep1 || runStep2
      ? await this.generateSearchQueries(idea)
      : { web_queries: [idea], github_query: idea };

    let competitors: WebSearchResult = {
      competitors: [],
      summary: "경쟁 제품 탐색 단계가 비활성화되었습니다.",
      raw_count: 0,
    };

    if (runStep1) {
      const webQueriesDisplay = (searchQueries.web_queries || [idea]).slice(0, 2).join(" / ");
      yield {
        event: "step_start",
        data: {
          step: 1,
          title: "경쟁 제품 탐색",
          description: `AI 최적화 키워드로 검색 중: ${webQueriesDisplay}`,
        },
      };
      await sleep(300);

      competitors = await this.searchWeb(idea, searchQueries.web_queries || []);
      yield { event: "step_result", data: { step: 1, result: competitors } };
    }

    let githubResults: GitHubSearchResult = {
      repos: [],
      total_count: 0,
      summary: "GitHub 유사 프로젝트 탐색 단계가 비활성화되었습니다.",
    };

    if (runStep2) {
      const ghQueryDisplay = searchQueries.github_query || idea;
      yield {
        event: "step_start",
        data: {
          step: 2,
          title: "GitHub 유사 프로젝트 탐색",
          description: `AI 최적화 키워드로 검색 중: ${ghQueryDisplay}`,
        },
      };
      await sleep(300);

      githubResults = await this.searchGithub(idea, searchQueries.github_query || "");
      yield { event: "step_result", data: { step: 2, result: githubResults } };
    }

    const dataAvailability: DataAvailabilityResult = runStep3
      ? await this.checkDataAndLibraries(idea)
      : fallbackDataAvailability();

    let feasibility: FeasibilityResult = fallbackFeasibility();
    if (runStep3) {
      yield {
        event: "step_start",
        data: {
          step: 3,
          title: "바이브코딩 실현성 분석",
          description: "AI가 바이브코딩 난이도와 병목 지점을 분석하고 있습니다...",
        },
      };
      await sleep(300);

      for await (const event of this.streamFeasibility(idea, dataAvailability)) {
        if (event.type === "progress") {
          yield { event: "step_progress", data: { step: 3, text: event.text } };
        } else {
          feasibility = event.result as unknown as FeasibilityResult;
        }
      }

      yield { event: "step_result", data: { step: 3, result: feasibility } };
    }

    let differentiation: DifferentiationResult = fallbackDifferentiation(competitors, githubResults);
    if (runStep4) {
      yield {
        event: "step_start",
        data: {
          step: 4,
          title: "차별화 분석",
          description: "기존 제품 대비 차별점을 분석하고 있습니다...",
        },
      };
      await sleep(300);

      for await (const event of this.streamDifferentiation(idea, competitors, githubResults)) {
        if (event.type === "progress") {
          yield { event: "step_progress", data: { step: 4, text: event.text } };
        } else {
          differentiation = event.result as unknown as DifferentiationResult;
        }
      }

      yield { event: "step_result", data: { step: 4, result: differentiation } };
    }

    if (runStep5) {
      yield {
        event: "step_start",
        data: {
          step: 5,
          title: "종합 판정",
          description: "최종 리포트를 생성하고 있습니다...",
        },
      };
      await sleep(300);

      let verdict = fallbackVerdict(feasibility, differentiation);
      for await (const event of this.streamVerdict(
        idea,
        {
          enabledSteps: activeSteps,
          competitors: runStep1 ? competitors : undefined,
          githubResults: runStep2 ? githubResults : undefined,
          feasibility: runStep3 ? feasibility : undefined,
          differentiation: runStep4 ? differentiation : undefined,
          dataAvailability: runStep3 ? dataAvailability : undefined,
        }
      )) {
        if (event.type === "progress") {
          yield { event: "step_progress", data: { step: 5, text: event.text } };
        } else {
          verdict = event.result as unknown as typeof verdict;
        }
      }

      yield { event: "step_result", data: { step: 5, result: verdict } };
    }

    yield { event: "done", data: { message: "분석 완료" } };
  }

  // --- Pre-step: Generate search queries ---

  private async generateSearchQueries(idea: string): Promise<{ web_queries: string[]; github_query: string }> {
    const fallback = { web_queries: [`${idea} tool service app`, `${idea} alternative competitor`], github_query: idea };
    if (!this.anthropicApiKey) return fallback;

    try {
      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-6"),
        maxOutputTokens: 256,
        messages: [{ role: "user", content: buildSearchQueriesPrompt(idea) }],
      });
      const result = parseJsonSafe<{ web_queries?: string[]; github_query?: string }>(text.trim(), {});
      if (result.web_queries && result.github_query) {
        return result as { web_queries: string[]; github_query: string };
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
          const retryCompetitors = await this.doWebSearchParallel(rq1, rq2, "advanced");
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
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

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
          signal: controller.signal,
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
          signal: controller.signal,
        }),
      ]);

      clearTimeout(timer);

      const competitors: Competitor[] = [];
      const seenUrls = new Set<string>();

      for (const resp of [resp1, resp2]) {
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
        model: anthropic("claude-sonnet-4-6"),
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

  // --- Step 2: GitHub search ---

  private async searchGithub(idea: string, aiQuery: string): Promise<GitHubSearchResult> {
    const baseQuery = (aiQuery || idea).trim().replace(/\s+/g, " ");
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const pushedAfter = twoYearsAgo.toISOString().slice(0, 10);
    const githubQuery = `${baseQuery} stars:>=50 pushed:>=${pushedAfter} archived:false`;
    const encodedQuery = encodeURIComponent(githubQuery);

    const cached = cacheGet<GitHubSearchResult>(this.buildCacheKey("github", githubQuery));
    if (cached) return cached;

    try {
      const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
      if (this.githubToken) {
        headers.Authorization = `token ${this.githubToken}`;
      }

      const resp = await fetch(
        `https://api.github.com/search/repositories?q=${encodedQuery}&sort=stars&order=desc&per_page=10`,
        { headers, signal: AbortSignal.timeout(15000) }
      );
      const data = await resp.json();

      const allRepos = (data.items || []).map((item: Record<string, unknown>) => ({
        name: (item.full_name as string) || "",
        description: ((item.description as string) || "").slice(0, 200),
        stars: (item.stargazers_count as number) || 0,
        url: (item.html_url as string) || "",
        language: (item.language as string) || "",
        updated: ((item.updated_at as string) || "").slice(0, 10),
      }));

      const repos = allRepos.filter(
        (r: { stars: number; updated: string }) =>
          r.stars >= 50 && new Date(r.updated) >= twoYearsAgo
      );

      const result: GitHubSearchResult = {
        repos,
        total_count: (data.total_count as number) || 0,
        summary: `유의미한 GitHub 저장소 ${repos.length}개를 선별했습니다 (전체 검색 모수 ${data.total_count || 0}개).`,
      };

      cacheSet(this.buildCacheKey("github", githubQuery), result);
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
              include_raw_content: true,
            }),
            signal: AbortSignal.timeout(20000),
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

  private mergeEvidenceByQueries(
    evidenceMap: Map<string, SearchEvidence>,
    queries: string[]
  ): SearchEvidence {
    const urls = new Set<string>();
    const snippets = new Set<string>();

    for (const query of queries) {
      const evidence = evidenceMap.get(query);
      if (!evidence) continue;

      for (const url of evidence.urls) {
        if (url) urls.add(url);
      }
      for (const snippet of evidence.snippets) {
        if (snippet) snippets.add(snippet);
      }
    }

    return {
      urls: Array.from(urls).slice(0, 8),
      snippets: Array.from(snippets).slice(0, 8),
    };
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

      const extracted = parseJsonSafe<{ data_sources?: string[]; libraries?: string[] }>(
        extractionText.trim(),
        extractionFallback
      );

      const dataSources = Array.from(
        new Set((extracted.data_sources || []).filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean))
      ).slice(0, 3);

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
      for (const source of dataSources) {
        const queriesForSource = [
          `${source} official API documentation`,
          `${source} developer portal`,
          `${source} scraping terms of service`,
        ];
        sourceQueriesByName.set(source, queriesForSource);
        sourceQueries.push(...queriesForSource);
      }

      const uniqueQueries = Array.from(new Set(sourceQueries));
      const evidenceMap = await this.doDataAvailabilitySearch(uniqueQueries, 9);

      const dataSourceResult = await Promise.all(
        dataSources.map(async (source) => {
          const evidence = this.mergeEvidenceByQueries(
            evidenceMap,
            sourceQueriesByName.get(source) || []
          );
          const robots = await this.checkRobotsPolicy(evidence.urls);
          const judged = evaluateDataSourceWithRules({
            urls: evidence.urls,
            snippets: evidence.snippets,
            robotsDisallowAll: robots.disallowAll,
            robotsCheckedDomain: robots.domain,
          });

          return {
            name: source,
            has_official_api: judged.has_official_api,
            crawlable: judged.crawlable,
            evidence_url: judged.evidence_url,
            blocking: judged.blocking,
            note: judged.note,
          };
        })
      );

      const libraryResult = await Promise.all(
        libraries.map((library) => this.validateLibraryOnNpm(library))
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

      const result = streamText({
        model: anthropic("claude-sonnet-4-6"),
        maxOutputTokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });

      for await (const chunk of result.textStream) {
        collectedText += chunk;
        charCount += chunk.length;
        if (charCount >= 80) {
          charCount = 0;
          yield { type: "progress", text: `AI 응답 생성 중... (${collectedText.length}자)` };
        }
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
    );
    const prompt = buildVerdictPrompt(idea, context);
    yield* this.callClaudeStream(prompt, fallback as unknown as Record<string, unknown>);
  }
}
