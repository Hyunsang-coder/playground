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
  buildDataJudgmentPrompt,
  buildFeasibilityPrompt,
  buildDifferentiationPrompt,
  buildVerdictPrompt,
} from "./prompts";

type ClaudeStreamEvent =
  | { type: "progress"; text: string }
  | { type: "result"; result: Record<string, unknown> };

type SearchEvidence = { urls: string[]; snippets: string[] };

export class IdeaAnalyzer {
  private anthropicApiKey: string;
  private tavilyApiKey: string;
  private githubToken: string;

  constructor(anthropicApiKey: string, tavilyApiKey: string, githubToken: string = "") {
    this.anthropicApiKey = anthropicApiKey;
    this.tavilyApiKey = tavilyApiKey;
    this.githubToken = githubToken;
  }

  async *analyze(
    idea: string,
    enabledSteps: number[] = [1, 2, 3, 4, 5]
  ): AsyncGenerator<SSEEvent> {
    const activeSteps = enabledSteps.length > 0 ? enabledSteps : [1, 2, 3, 4, 5];
    const shouldRun = (step: number) => activeSteps.includes(step);

    const searchQueries = shouldRun(1) || shouldRun(2)
      ? await this.generateSearchQueries(idea)
      : { web_queries: [idea], github_query: idea };

    let competitors: WebSearchResult = {
      competitors: [],
      summary: "경쟁 제품 탐색 단계가 비활성화되었습니다.",
      raw_count: 0,
    };

    if (shouldRun(1)) {
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

    if (shouldRun(2)) {
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

    const dataAvailability: DataAvailabilityResult = shouldRun(3)
      ? await this.checkDataAndLibraries(idea)
      : fallbackDataAvailability();

    let feasibility: FeasibilityResult = fallbackFeasibility();
    if (shouldRun(3)) {
      yield {
        event: "step_start",
        data: {
          step: 3,
          title: "바이브코딩 실현성 분석",
          description: "AI가 바이브코딩 난이도와 병목 지점을 분석하고 있습니다...",
        },
      };
      await sleep(300);

      for await (const event of this.streamFeasibility(
        idea,
        competitors,
        githubResults,
        dataAvailability
      )) {
        if (event.type === "progress") {
          yield { event: "step_progress", data: { step: 3, text: event.text } };
        } else {
          feasibility = event.result as unknown as FeasibilityResult;
        }
      }

      yield { event: "step_result", data: { step: 3, result: feasibility } };
    }

    let differentiation: DifferentiationResult = fallbackDifferentiation(competitors, githubResults);
    if (shouldRun(4)) {
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

    if (shouldRun(5)) {
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
        competitors,
        githubResults,
        feasibility,
        differentiation,
        dataAvailability
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

    const cacheKey = `web:${query1}|${query2}`;
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

  // --- Step 2: GitHub search ---

  private async searchGithub(idea: string, aiQuery: string): Promise<GitHubSearchResult> {
    const query = encodeURIComponent(aiQuery || idea);

    const cached = cacheGet<GitHubSearchResult>(`github:${query}`);
    if (cached) return cached;

    try {
      const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
      if (this.githubToken) {
        headers.Authorization = `token ${this.githubToken}`;
      }

      const resp = await fetch(
        `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=10`,
        { headers, signal: AbortSignal.timeout(15000) }
      );
      const data = await resp.json();

      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

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

      cacheSet(`github:${query}`, result);
      return result;
    } catch (e) {
      return { repos: [], total_count: 0, summary: `GitHub 검색 중 오류: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  private async doDataAvailabilitySearch(
    queries: string[]
  ): Promise<Map<string, SearchEvidence>> {
    const limitedQueries = queries.slice(0, 6);

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

  private async checkDataAndLibraries(idea: string): Promise<DataAvailabilityResult> {
    if (!this.anthropicApiKey) {
      return fallbackDataAvailability();
    }

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
        return fallbackDataAvailability();
      }

      const queries: string[] = [];
      for (const source of dataSources) {
        queries.push(`${source} official API documentation`);
        queries.push(`${source} developer portal`);
      }
      for (const library of libraries) {
        queries.push(`npm ${library} package`);
      }

      const limitedQueries = queries.slice(0, 6);
      const evidenceMap = await this.doDataAvailabilitySearch(limitedQueries);
      const evidence: Record<string, { urls: string[]; snippets: string[] }> = {};

      for (const q of limitedQueries) {
        evidence[q] = evidenceMap.get(q) || { urls: [], snippets: [] };
      }

      const judgmentPrompt = buildDataJudgmentPrompt(dataSources, libraries, evidence);
      const { text: judgmentText } = await generateText({
        model: anthropic("claude-sonnet-4-6"),
        maxOutputTokens: 2048,
        messages: [{ role: "user", content: judgmentPrompt }],
      });

      const parsed = parseJsonSafe<Partial<DataAvailabilityResult>>(
        judgmentText.trim(),
        fallbackDataAvailability()
      );

      const dataSourceResult = Array.isArray(parsed.data_sources)
        ? parsed.data_sources
          .filter((item): item is NonNullable<Partial<DataAvailabilityResult>["data_sources"]>[number] =>
            typeof item === "object" && item !== null
          )
          .map((item, index) => {
            const hasOfficialApi = Boolean(item.has_official_api);
            const crawlable = Boolean(item.crawlable);
            return {
              name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : dataSources[index] || "Unknown source",
              has_official_api: hasOfficialApi,
              crawlable,
              evidence_url: typeof item.evidence_url === "string" ? item.evidence_url : undefined,
              // PLAN 원칙: 공식 API 또는 크롤링 가능이면 블로커가 아니다.
              blocking: Boolean(item.blocking) && !hasOfficialApi && !crawlable,
              note: typeof item.note === "string" && item.note.trim() ? item.note.trim() : "근거 부족",
            };
          })
        : [];

      const libraryResult = Array.isArray(parsed.libraries)
        ? parsed.libraries
          .filter((item): item is NonNullable<Partial<DataAvailabilityResult>["libraries"]>[number] =>
            typeof item === "object" && item !== null
          )
          .map((item, index) => ({
            name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : libraries[index] || "Unknown library",
            available_on_npm: Boolean(item.available_on_npm),
            package_name: typeof item.package_name === "string" && item.package_name.trim()
              ? item.package_name.trim()
              : undefined,
            note: typeof item.note === "string" && item.note.trim() ? item.note.trim() : "근거 부족",
          }))
        : [];

      const hasBlockingIssues = dataSourceResult.some((source) => source.blocking) || Boolean(parsed.has_blocking_issues);

      return {
        data_sources: dataSourceResult,
        libraries: libraryResult,
        has_blocking_issues: hasBlockingIssues,
      };
    } catch {
      return fallbackDataAvailability();
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
    competitors: WebSearchResult,
    githubResults: GitHubSearchResult,
    dataAvailability: DataAvailabilityResult
  ): AsyncGenerator<ClaudeStreamEvent> {
    const fallback = fallbackFeasibility();
    const prompt = buildFeasibilityPrompt(idea, competitors, githubResults, dataAvailability);

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
    competitors: WebSearchResult,
    githubResults: GitHubSearchResult,
    feasibility: FeasibilityResult,
    differentiation: DifferentiationResult,
    dataAvailability: DataAvailabilityResult
  ): AsyncGenerator<ClaudeStreamEvent> {
    const fallback = fallbackVerdict(feasibility, differentiation);
    const prompt = buildVerdictPrompt(
      idea,
      competitors,
      githubResults,
      feasibility,
      differentiation,
      dataAvailability
    );
    yield* this.callClaudeStream(prompt, fallback as unknown as Record<string, unknown>);
  }
}
