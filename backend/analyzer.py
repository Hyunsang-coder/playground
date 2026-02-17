import json
import asyncio
from typing import AsyncGenerator
import httpx
import anthropic


class IdeaAnalyzer:
    def __init__(self, anthropic_api_key: str, tavily_api_key: str, github_token: str = ""):
        self.anthropic_client = anthropic.AsyncAnthropic(api_key=anthropic_api_key) if anthropic_api_key else None
        self.tavily_api_key = tavily_api_key
        self.github_token = github_token

    async def analyze(self, idea: str, mode: str) -> AsyncGenerator[dict, None]:
        """Main analysis pipeline — streams SSE events step by step."""

        # Pre-step: AI generates optimized search queries
        search_queries = await self._generate_search_queries(idea)

        # Step 1: Web search for competitors (using AI-optimized queries)
        web_queries_display = " / ".join(search_queries.get("web_queries", [idea])[:2])
        yield {"event": "step_start", "data": {"step": 1, "title": "경쟁 제품 탐색", "description": f"AI 최적화 키워드로 검색 중: {web_queries_display}"}}
        await asyncio.sleep(0.3)

        competitors = await self._search_web(idea, search_queries.get("web_queries", []))
        yield {"event": "step_result", "data": {"step": 1, "result": competitors}}

        # Step 2: GitHub search for similar projects (using AI-optimized queries)
        gh_query_display = search_queries.get("github_query", idea)
        yield {"event": "step_start", "data": {"step": 2, "title": "GitHub 유사 프로젝트 탐색", "description": f"AI 최적화 키워드로 검색 중: {gh_query_display}"}}
        await asyncio.sleep(0.3)

        github_results = await self._search_github(idea, search_queries.get("github_query", ""))
        yield {"event": "step_result", "data": {"step": 2, "result": github_results}}

        # Step 3: Technical feasibility analysis (LLM with streaming)
        yield {"event": "step_start", "data": {"step": 3, "title": "기술 실현성 분석", "description": "AI가 기술적 구현 가능성을 분석하고 있습니다..."}}
        await asyncio.sleep(0.3)

        feasibility = None
        async for event in self._stream_feasibility(idea, mode, competitors, github_results):
            if event["type"] == "progress":
                yield {"event": "step_progress", "data": {"step": 3, "text": event["text"]}}
            else:
                feasibility = event["result"]
        yield {"event": "step_result", "data": {"step": 3, "result": feasibility}}

        # Step 4: Differentiation analysis (LLM with streaming)
        yield {"event": "step_start", "data": {"step": 4, "title": "차별화 분석", "description": "기존 제품 대비 차별점을 분석하고 있습니다..."}}
        await asyncio.sleep(0.3)

        differentiation = None
        async for event in self._stream_differentiation(idea, competitors, github_results):
            if event["type"] == "progress":
                yield {"event": "step_progress", "data": {"step": 4, "text": event["text"]}}
            else:
                differentiation = event["result"]
        yield {"event": "step_result", "data": {"step": 4, "result": differentiation}}

        # Step 5: Final verdict (LLM with streaming)
        yield {"event": "step_start", "data": {"step": 5, "title": "종합 판정", "description": "최종 리포트를 생성하고 있습니다..."}}
        await asyncio.sleep(0.3)

        verdict = None
        async for event in self._stream_verdict(idea, mode, competitors, github_results, feasibility, differentiation):
            if event["type"] == "progress":
                yield {"event": "step_progress", "data": {"step": 5, "text": event["text"]}}
            else:
                verdict = event["result"]
        yield {"event": "step_result", "data": {"step": 5, "result": verdict}}

        yield {"event": "done", "data": {"message": "분석 완료"}}

    async def _generate_search_queries(self, idea: str) -> dict:
        """Use Claude to generate optimized search queries from the idea."""
        if not self.anthropic_client:
            return {"web_queries": [f"{idea} tool service app", f"{idea} alternative competitor"], "github_query": idea}

        prompt = f"""사용자의 아이디어를 기반으로 경쟁 제품과 유사 프로젝트를 찾기 위한 최적의 검색 키워드를 생성하세요.

아이디어: {idea}

반드시 순수 JSON으로만 응답하세요:

{{
  "web_queries": ["영어 웹 검색 쿼리 1", "영어 웹 검색 쿼리 2"],
  "github_query": "GitHub 검색에 최적화된 영어 키워드 (공백 구분)"
}}

규칙:
- web_queries: 정확히 2개의 영어 검색 쿼리. 첫 번째는 일반 검색, 두 번째는 경쟁 제품 검색
- github_query: GitHub 저장소 검색에 적합한 영어 키워드 (2~4단어)
- 핵심 기술과 도메인을 반영할 것"""

        try:
            response = await self.anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=256,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
            result = self._parse_json_safe(text, {})
            if "web_queries" in result and "github_query" in result:
                return result
        except Exception:
            pass

        return {"web_queries": [f"{idea} tool service app", f"{idea} alternative competitor"], "github_query": idea}

    async def _search_web(self, idea: str, ai_queries: list[str] | None = None) -> dict:
        """Search web for competitors using Tavily API with AI-optimized queries.

        Improvements over basic search:
        1. Two Tavily calls run in parallel (asyncio.gather)
        2. If results < 3, refines queries via Claude + retries with advanced depth
        3. Filters results for relevance using Claude (removes blog posts, tutorials, etc.)
        4. Uses include_raw_content for richer 500-char snippets
        5. Dynamically escalates search_depth from basic → advanced on retry
        """
        if not self.tavily_api_key:
            return {"competitors": [], "summary": "검색 API 키가 설정되지 않았습니다.", "raw_count": 0}

        query1 = ai_queries[0] if ai_queries and len(ai_queries) > 0 else f"{idea} tool service app"
        query2 = ai_queries[1] if ai_queries and len(ai_queries) > 1 else f"{idea} alternative competitor similar"

        try:
            # Phase 1: Parallel basic search with extended snippets
            competitors = await self._do_web_search_parallel(query1, query2, depth="basic")

            # Phase 2: If results are sparse, refine queries + retry with advanced depth
            if len(competitors) < 3:
                refined_queries = await self._refine_search_queries(idea, competitors)
                if refined_queries:
                    rq1 = refined_queries[0] if len(refined_queries) > 0 else query1
                    rq2 = refined_queries[1] if len(refined_queries) > 1 else query2
                    retry_competitors = await self._do_web_search_parallel(rq1, rq2, depth="advanced")
                    existing_urls = {c["url"] for c in competitors}
                    for c in retry_competitors:
                        if c["url"] not in existing_urls:
                            competitors.append(c)
                            existing_urls.add(c["url"])

            # Phase 3: Filter for relevance using Claude
            if competitors and self.anthropic_client:
                competitors = await self._filter_relevant(idea, competitors)

            return {
                "competitors": competitors[:10],
                "raw_count": len(competitors),
                "summary": f"웹에서 {len(competitors)}개의 관련 결과를 발견했습니다.",
            }
        except Exception as e:
            return {"competitors": [], "summary": f"검색 중 오류: {str(e)}", "raw_count": 0}

    async def _do_web_search_parallel(self, query1: str, query2: str, depth: str = "basic") -> list[dict]:
        """Execute two Tavily searches in parallel and merge results with dedup."""
        timeout = 25.0 if depth == "advanced" else 15.0
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp1, resp2 = await asyncio.gather(
                    client.post(
                        "https://api.tavily.com/search",
                        json={
                            "api_key": self.tavily_api_key,
                            "query": query1,
                            "max_results": 8,
                            "search_depth": depth,
                            "include_raw_content": True,
                        },
                    ),
                    client.post(
                        "https://api.tavily.com/search",
                        json={
                            "api_key": self.tavily_api_key,
                            "query": query2,
                            "max_results": 5,
                            "search_depth": depth,
                            "include_raw_content": True,
                        },
                    ),
                )

                competitors = []
                seen_urls = set()

                for resp in [resp1, resp2]:
                    data = resp.json()
                    for r in data.get("results", []):
                        url = r.get("url", "")
                        if url and url not in seen_urls:
                            seen_urls.add(url)
                            raw = r.get("raw_content") or r.get("content") or ""
                            competitors.append({
                                "title": r.get("title", ""),
                                "url": url,
                                "snippet": raw[:500],
                            })

                return competitors
        except Exception:
            return []

    async def _refine_search_queries(self, idea: str, current_results: list[dict]) -> list[str]:
        """Use Claude to generate refined search queries when initial results are sparse."""
        if not self.anthropic_client:
            return []

        results_summary = "\n".join(
            [f"- {c['title']}" for c in current_results[:5]]
        ) or "결과 없음"

        prompt = f"""초기 검색 결과가 부실합니다. 더 나은 검색 쿼리를 생성하세요.

아이디어: {idea}
현재 검색 결과 ({len(current_results)}개):
{results_summary}

반드시 순수 JSON으로만 응답하세요:
{{"queries": ["개선된 영어 검색 쿼리 1", "개선된 영어 검색 쿼리 2"]}}

규칙:
- 이전 쿼리와 다른 각도로 검색할 것
- 더 넓은 키워드 또는 유사 도메인으로 검색
- 동의어, 상위 카테고리, 관련 기술 활용"""

        try:
            response = await self.anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=128,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
            result = self._parse_json_safe(text, {})
            return result.get("queries", [])
        except Exception:
            return []

    async def _filter_relevant(self, idea: str, competitors: list[dict]) -> list[dict]:
        """Use Claude to filter search results, keeping only actual competitors."""
        if not competitors:
            return []

        items = []
        for i, c in enumerate(competitors):
            items.append(f"{i}. {c['title']} — {c['snippet'][:100]}")
        items_text = "\n".join(items)

        prompt = f"""아이디어: {idea}

아래 검색 결과에서 실제 경쟁 제품/서비스/도구인 것만 골라주세요.
뉴스 기사, 블로그 포스트, 튜토리얼, 문서 등은 제외하세요.

{items_text}

반드시 순수 JSON으로만 응답하세요:
{{"relevant_indices": [0, 2, 5]}}"""

        try:
            response = await self.anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=128,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
            result = self._parse_json_safe(text, {})
            indices = result.get("relevant_indices", list(range(len(competitors))))
            return [competitors[i] for i in indices if isinstance(i, int) and 0 <= i < len(competitors)]
        except Exception:
            return competitors

    async def _search_github(self, idea: str, ai_query: str = "") -> dict:
        """Search GitHub for similar projects with AI-optimized query."""
        try:
            headers = {"Accept": "application/vnd.github.v3+json"}
            if self.github_token:
                headers["Authorization"] = f"token {self.github_token}"

            # Use AI-generated query or fall back to raw idea
            query = (ai_query or idea).replace(" ", "+")

            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"https://api.github.com/search/repositories?q={query}&sort=stars&order=desc&per_page=10",
                    headers=headers,
                )
                data = resp.json()

                repos = []
                for item in data.get("items", []):
                    repos.append({
                        "name": item.get("full_name", ""),
                        "description": (item.get("description") or "")[:200],
                        "stars": item.get("stargazers_count", 0),
                        "url": item.get("html_url", ""),
                        "language": item.get("language", ""),
                        "updated": item.get("updated_at", "")[:10],
                    })

                return {
                    "repos": repos,
                    "total_count": data.get("total_count", 0),
                    "summary": f"GitHub에서 {data.get('total_count', 0)}개의 관련 저장소를 발견했습니다.",
                }
        except Exception as e:
            return {"repos": [], "total_count": 0, "summary": f"GitHub 검색 중 오류: {str(e)}"}

    async def _call_claude_stream(self, prompt: str, fallback: dict, max_tokens: int = 1024) -> AsyncGenerator[dict, None]:
        """Call Claude with streaming, yielding progress events and final result."""
        if not self.anthropic_client:
            yield {"type": "result", "result": fallback}
            return

        try:
            collected_text = ""
            char_count = 0
            async with self.anthropic_client.messages.stream(
                model="claude-sonnet-4-20250514",
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                async for text in stream.text_stream:
                    collected_text += text
                    char_count += len(text)
                    # Emit progress every ~80 chars
                    if char_count >= 80:
                        char_count = 0
                        yield {"type": "progress", "text": f"AI 응답 생성 중... ({len(collected_text)}자)"}

            result = self._parse_json_safe(collected_text.strip(), fallback)
            yield {"type": "result", "result": result}
        except Exception:
            yield {"type": "result", "result": fallback}

    async def _stream_feasibility(self, idea: str, mode: str, competitors: dict, github_results: dict) -> AsyncGenerator[dict, None]:
        """Stream feasibility analysis."""
        fallback = self._fallback_feasibility(idea)
        prompt = self._build_feasibility_prompt(idea, mode, competitors, github_results)
        async for event in self._call_claude_stream(prompt, fallback):
            yield event

    async def _stream_differentiation(self, idea: str, competitors: dict, github_results: dict) -> AsyncGenerator[dict, None]:
        """Stream differentiation analysis."""
        fallback = self._fallback_differentiation(idea, competitors, github_results)
        prompt = self._build_differentiation_prompt(idea, competitors, github_results)
        async for event in self._call_claude_stream(prompt, fallback):
            yield event

    async def _stream_verdict(self, idea: str, mode: str, competitors: dict, github_results: dict, feasibility: dict, differentiation: dict) -> AsyncGenerator[dict, None]:
        """Stream verdict generation."""
        fallback = self._fallback_verdict(feasibility, differentiation)
        prompt = self._build_verdict_prompt(idea, mode, competitors, github_results, feasibility, differentiation)
        async for event in self._call_claude_stream(prompt, fallback):
            yield event

    def _build_feasibility_prompt(self, idea: str, mode: str, competitors: dict, github_results: dict) -> str:
        mode_context = {
            "hackathon": "4시간 해커톤 (1인 개발자)",
            "startup": "초기 스타트업 (3-5명 팀, 3개월)",
            "sideproject": "사이드 프로젝트 (1-2명, 주말 개발)",
        }
        return f"""당신은 기술 실현성을 냉정하게 분석하는 시니어 개발자입니다.

아이디어: {idea}
개발 환경: {mode_context.get(mode, mode_context["hackathon"])}

기존 경쟁 제품 수: {competitors.get("raw_count", 0)}개
GitHub 유사 프로젝트: {github_results.get("total_count", 0)}개

다음을 분석해주세요. 반드시 순수 JSON으로만 응답하세요:

{{
  "overall_feasibility": "possible" | "partial" | "difficult",
  "score": 0-100,
  "tech_requirements": [
    {{"name": "기술/API명", "available": true/false, "difficulty": "easy|medium|hard", "note": "한줄 설명"}}
  ],
  "key_risks": ["리스크 1", "리스크 2"],
  "time_estimate": "예상 개발 시간",
  "summary": "한줄 종합 판단"
}}"""

    def _build_differentiation_prompt(self, idea: str, competitors: dict, github_results: dict) -> str:
        competitor_list = "\n".join(
            [f"- {c['title']}: {c['snippet']}" for c in competitors.get("competitors", [])[:5]]
        ) or "발견된 경쟁 제품 없음"

        github_list = "\n".join(
            [f"- {r['name']} (⭐{r['stars']}): {r['description']}" for r in github_results.get("repos", [])[:5]]
        ) or "발견된 유사 프로젝트 없음"

        return f"""당신은 Devil's Advocate입니다. 아이디어의 차별화 가능성을 냉정하게 분석하세요.

아이디어: {idea}

경쟁 제품:
{competitor_list}

GitHub 유사 프로젝트:
{github_list}

반드시 순수 JSON으로만 응답하세요:

{{
  "competition_level": "blue_ocean" | "moderate" | "red_ocean",
  "competition_score": 0-100,
  "existing_solutions": [
    {{"name": "제품/프로젝트명", "similarity": 0-100, "weakness": "약점"}}
  ],
  "unique_angles": ["차별화 포인트 1", "차별화 포인트 2"],
  "devil_arguments": ["이 아이디어가 실패하는 이유 1", "이유 2", "이유 3"],
  "pivot_suggestions": ["대안 아이디어 1", "대안 아이디어 2"],
  "summary": "한줄 종합"
}}"""

    def _build_verdict_prompt(self, idea: str, mode: str, competitors: dict, github_results: dict, feasibility: dict, differentiation: dict) -> str:
        return f"""당신은 해커톤 아이디어 심판관입니다. 모든 분석 결과를 종합하여 최종 판정을 내리세요.

아이디어: {idea}
모드: {mode}

경쟁 현황:
- 웹 검색 결과: {competitors.get("raw_count", 0)}개
- GitHub 유사 프로젝트: {github_results.get("total_count", 0)}개
- 경쟁 수준: {differentiation.get("competition_level", "unknown")}

기술 실현성:
- 점수: {feasibility.get("score", 50)}/100
- 판정: {feasibility.get("overall_feasibility", "unknown")}
- 핵심 리스크: {json.dumps(feasibility.get("key_risks", []), ensure_ascii=False)}

차별화:
- 경쟁 점수: {differentiation.get("competition_score", 50)}/100
- Devil's Arguments: {json.dumps(differentiation.get("devil_arguments", []), ensure_ascii=False)}

반드시 순수 JSON으로만 응답하세요:

{{
  "verdict": "GO" | "PIVOT" | "KILL",
  "confidence": 0-100,
  "overall_score": 0-100,
  "scores": {{
    "competition": 0-100,
    "feasibility": 0-100,
    "differentiation": 0-100,
    "timing": 0-100
  }},
  "one_liner": "한 줄 판정 이유",
  "recommendation": "구체적 추천 행동",
  "alternative_ideas": ["대안 1", "대안 2", "대안 3"]
}}"""

    def _parse_json_safe(self, text: str, fallback: dict) -> dict:
        """Safely parse JSON from LLM response."""
        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        # Try extracting JSON from markdown code block
        if "```" in text:
            try:
                json_str = text.split("```")[1]
                if json_str.startswith("json"):
                    json_str = json_str[4:]
                return json.loads(json_str.strip())
            except (json.JSONDecodeError, IndexError):
                pass
        # Try finding first { to last }
        try:
            start = text.index("{")
            end = text.rindex("}") + 1
            return json.loads(text[start:end])
        except (ValueError, json.JSONDecodeError):
            pass
        return fallback

    def _fallback_feasibility(self, idea: str) -> dict:
        return {
            "overall_feasibility": "partial",
            "score": 50,
            "tech_requirements": [],
            "key_risks": ["LLM 분석 실패 — fallback 데이터입니다"],
            "time_estimate": "알 수 없음",
            "summary": "AI 분석을 수행하지 못했습니다. API 키를 확인하세요.",
        }

    def _fallback_differentiation(self, idea: str, competitors: dict, github_results: dict) -> dict:
        comp_count = competitors.get("raw_count", 0) + github_results.get("total_count", 0)
        level = "red_ocean" if comp_count > 20 else "moderate" if comp_count > 5 else "blue_ocean"
        return {
            "competition_level": level,
            "competition_score": max(0, 100 - comp_count * 5),
            "existing_solutions": [],
            "unique_angles": [],
            "devil_arguments": ["AI 분석 없이는 구체적 약점을 파악할 수 없습니다"],
            "pivot_suggestions": [],
            "summary": f"경쟁 제품 {comp_count}개 기반 자동 판정",
        }

    def _fallback_verdict(self, feasibility: dict, differentiation: dict) -> dict:
        f_score = feasibility.get("score", 50)
        d_score = differentiation.get("competition_score", 50)
        avg = (f_score + d_score) // 2
        verdict = "GO" if avg >= 70 else "PIVOT" if avg >= 40 else "KILL"
        return {
            "verdict": verdict,
            "confidence": 40,
            "overall_score": avg,
            "scores": {
                "competition": d_score,
                "feasibility": f_score,
                "differentiation": d_score,
                "timing": 50,
            },
            "one_liner": "AI 분석 없이 점수 기반 자동 판정입니다.",
            "recommendation": "API 키를 설정하면 더 정확한 분석을 받을 수 있습니다.",
            "alternative_ideas": [],
        }
