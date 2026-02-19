// IdeaAnalyzer class — 5-step analysis pipeline, ported from backend/analyzer.py
// Uses Vercel AI SDK (@ai-sdk/anthropic + ai) instead of anthropic Python SDK

import { generateText, streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  parseJsonSafe,
  fallbackFeasibility,
  fallbackDifferentiation,
  fallbackVerdict,
  cacheGet,
  cacheSet,
  sleep,
  type SSEEvent,
  type Competitor,
  type WebSearchResult,
  type GitHubSearchResult,
  type FeasibilityResult,
  type DifferentiationResult,
} from "./utils";
import {
  buildSearchQueriesPrompt,
  buildRefineSearchQueriesPrompt,
  buildFilterRelevantPrompt,
  buildFeasibilityPrompt,
  buildDifferentiationPrompt,
  buildVerdictPrompt,
} from "./prompts";

export class IdeaAnalyzer {
  private anthropicApiKey: string;
  private tavilyApiKey: string;
  private githubToken: string;

  constructor(anthropicApiKey: string, tavilyApiKey: string, githubToken: string = "") {
    this.anthropicApiKey = anthropicApiKey;
    this.tavilyApiKey = tavilyApiKey;
    this.githubToken = githubToken;
  }

  async *analyze(idea: string, mode: string): AsyncGenerator<SSEEvent> {
    // Pre-step: AI generates optimized search queries
    const searchQueries = await this.generateSearchQueries(idea);

    // Step 1: Web search for competitors
    const webQueriesDisplay = (searchQueries.web_queries || [idea]).slice(0, 2).join(" / ");
    yield { event: "step_start", data: { step: 1, title: "경쟁 제품 탐색", description: `AI 최적화 키워드로 검색 중: ${webQueriesDisplay}` } };
    await sleep(300);

    const competitors = await this.searchWeb(idea, searchQueries.web_queries || []);
    yield { event: "step_result", data: { step: 1, result: competitors } };

    // Step 2: GitHub search for similar projects
    const ghQueryDisplay = searchQueries.github_query || idea;
    yield { event: "step_start", data: { step: 2, title: "GitHub 유사 프로젝트 탐색", description: `AI 최적화 키워드로 검색 중: ${ghQueryDisplay}` } };
    await sleep(300);

    const githubResults = await this.searchGithub(idea, searchQueries.github_query || "");
    yield { event: "step_result", data: { step: 2, result: githubResults } };

    // Step 3: Vibe coding feasibility analysis (streaming)
    yield { event: "step_start", data: { step: 3, title: "바이브코딩 실현성 분석", description: "AI가 바이브코딩 난이도와 병목 지점을 분석하고 있습니다..." } };
    await sleep(300);

    let feasibility: FeasibilityResult | null = null;
    for await (const event of this.streamFeasibility(idea, mode, competitors, githubResults)) {
      if (event.type === "progress") {
        yield { event: "step_progress", data: { step: 3, text: event.text } };
      } else {
        feasibility = event.result as unknown as FeasibilityResult;
      }
    }
    yield { event: "step_result", data: { step: 3, result: feasibility } };

    // Step 4: Differentiation analysis (streaming)
    yield { event: "step_start", data: { step: 4, title: "차별화 분석", description: "기존 제품 대비 차별점을 분석하고 있습니다..." } };
    await sleep(300);

    let differentiation: DifferentiationResult | null = null;
    for await (const event of this.streamDifferentiation(idea, competitors, githubResults)) {
      if (event.type === "progress") {
        yield { event: "step_progress", data: { step: 4, text: event.text } };
      } else {
        differentiation = event.result as unknown as DifferentiationResult;
      }
    }
    yield { event: "step_result", data: { step: 4, result: differentiation } };

    // Step 5: Final verdict (streaming)
    yield { event: "step_start", data: { step: 5, title: "종합 판정", description: "최종 리포트를 생성하고 있습니다..." } };
    await sleep(300);

    let verdict = null;
    for await (const event of this.streamVerdict(idea, mode, competitors, githubResults, feasibility!, differentiation!)) {
      if (event.type === "progress") {
        yield { event: "step_progress", data: { step: 5, text: event.text } };
      } else {
        verdict = event.result;
      }
    }
    yield { event: "step_result", data: { step: 5, result: verdict } };

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

  // --- Steps 3-5: Claude streaming ---

  private async *callClaudeStream(
    prompt: string,
    fallback: Record<string, unknown>
  ): AsyncGenerator<{ type: "progress"; text: string } | { type: "result"; result: Record<string, unknown> }> {
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
    mode: string,
    competitors: WebSearchResult,
    githubResults: GitHubSearchResult
  ) {
    const fallback = fallbackFeasibility();
    const prompt = buildFeasibilityPrompt(idea, mode, competitors, githubResults);
    yield* this.callClaudeStream(prompt, fallback as unknown as Record<string, unknown>);
  }

  private async *streamDifferentiation(
    idea: string,
    competitors: WebSearchResult,
    githubResults: GitHubSearchResult
  ) {
    const fallback = fallbackDifferentiation(competitors, githubResults);
    const prompt = buildDifferentiationPrompt(idea, competitors, githubResults);
    yield* this.callClaudeStream(prompt, fallback as unknown as Record<string, unknown>);
  }

  private async *streamVerdict(
    idea: string,
    mode: string,
    competitors: WebSearchResult,
    githubResults: GitHubSearchResult,
    feasibility: FeasibilityResult,
    differentiation: DifferentiationResult
  ) {
    const fallback = fallbackVerdict(feasibility, differentiation);
    const prompt = buildVerdictPrompt(idea, mode, competitors, githubResults, feasibility, differentiation);
    yield* this.callClaudeStream(prompt, fallback as unknown as Record<string, unknown>);
  }
}
