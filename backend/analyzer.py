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

        # Pre-step: AI generates optimized search queries + identifies key data sources
        search_queries = await self._generate_search_queries(idea)

        # Step 1 & 2: Run web search and GitHub search in parallel
        web_queries_display = " / ".join(search_queries.get("web_queries", [idea])[:2])
        gh_query_display = search_queries.get("github_query", idea)

        yield {"event": "step_start", "data": {"step": 1, "title": "경쟁 제품 탐색", "description": f"AI 최적화 키워드로 검색 중: {web_queries_display}"}}
        yield {"event": "step_start", "data": {"step": 2, "title": "GitHub 유사 프로젝트 탐색", "description": f"AI 최적화 키워드로 검색 중: {gh_query_display}"}}

        # Parallel execution
        competitors, github_results = await asyncio.gather(
            self._search_web(idea, search_queries.get("web_queries", [])),
            self._search_github(idea, search_queries.get("github_query", "")),
        )

        yield {"event": "step_result", "data": {"step": 1, "result": competitors}}
        yield {"event": "step_result", "data": {"step": 2, "result": github_results}}

        # Between Step 2 and 3: AI filters search results for relevance
        yield {"event": "step_progress", "data": {"step": 3, "text": "검색 결과 관련성 필터링 중..."}}
        filtered = await self._filter_relevance(idea, competitors, github_results)

        # Step 3: Technical feasibility analysis (with real data + API verification)
        yield {"event": "step_start", "data": {"step": 3, "title": "기술 실현성 분석", "description": "데이터 소스 접근성 및 기술 구현 가능성을 검증하고 있습니다..."}}
        await asyncio.sleep(0.3)

        # Run API/data source verification in parallel with AI analysis
        api_check = await self._check_data_sources(idea, search_queries.get("required_apis", []))

        feasibility = None
        async for event in self._stream_feasibility(idea, mode, filtered, api_check):
            if event["type"] == "progress":
                yield {"event": "step_progress", "data": {"step": 3, "text": event["text"]}}
            else:
                feasibility = event["result"]
        yield {"event": "step_result", "data": {"step": 3, "result": feasibility}}

        # Step 4: Differentiation analysis (with full competitor data)
        yield {"event": "step_start", "data": {"step": 4, "title": "차별화 분석", "description": "기존 제품 대비 차별점을 분석하고 있습니다..."}}
        await asyncio.sleep(0.3)

        differentiation = None
        async for event in self._stream_differentiation(idea, filtered):
            if event["type"] == "progress":
                yield {"event": "step_progress", "data": {"step": 4, "text": event["text"]}}
            else:
                differentiation = event["result"]
        yield {"event": "step_result", "data": {"step": 4, "result": differentiation}}

        # Step 5: Final verdict (with ALL analysis data)
        yield {"event": "step_start", "data": {"step": 5, "title": "종합 판정", "description": "모든 분석 결과를 교차 검증하고 최종 리포트를 생성합니다..."}}
        await asyncio.sleep(0.3)

        verdict = None
        async for event in self._stream_verdict(idea, mode, filtered, feasibility, differentiation, api_check):
            if event["type"] == "progress":
                yield {"event": "step_progress", "data": {"step": 5, "text": event["text"]}}
            else:
                verdict = event["result"]
        yield {"event": "step_result", "data": {"step": 5, "result": verdict}}

        yield {"event": "done", "data": {"message": "분석 완료"}}

    # ──────────────────────────────────────────────────────
    # Pre-step: AI search query generation + API identification
    # ──────────────────────────────────────────────────────

    async def _generate_search_queries(self, idea: str) -> dict:
        """Use Claude to generate optimized search queries AND identify required APIs/data sources."""
        if not self.anthropic_client:
            return {
                "web_queries": [f"{idea} tool service app", f"{idea} alternative competitor"],
                "github_query": idea,
                "required_apis": [],
            }

        prompt = f"""사용자의 아이디어를 분석하여 다음을 생성하세요:
1. 경쟁 제품을 찾기 위한 최적 검색 키워드
2. 이 아이디어를 구현하는 데 필요한 핵심 데이터 소스/API 목록

아이디어: {idea}

반드시 순수 JSON으로만 응답하세요:

{{
  "web_queries": ["영어 웹 검색 쿼리 1", "영어 웹 검색 쿼리 2"],
  "github_query": "GitHub 검색에 최적화된 영어 키워드",
  "required_apis": [
    {{
      "name": "데이터 소스/API명 (예: Naver Review API, Twitter API)",
      "purpose": "이 API가 필요한 이유",
      "check_url": "API 존재 여부를 확인할 수 있는 공식 문서 URL 또는 빈 문자열",
      "alternatives": ["대안 1", "대안 2"],
      "known_blocked": true/false
    }}
  ]
}}

규칙:
- web_queries: 정확히 2개의 영어 검색 쿼리
- github_query: GitHub 저장소 검색에 적합한 영어 키워드 (2~4단어)
- required_apis: 아이디어 구현에 필수적인 외부 데이터 소스를 모두 나열
  - 크롤링이 차단된 것으로 알려진 사이트(네이버, 쿠팡, 배민 등)는 known_blocked: true
  - 공식 API가 없거나 제한적인 경우도 명시
  - 대안이 있으면 alternatives에 포함"""

        try:
            response = await self.anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
            result = self._parse_json_safe(text, {})
            if "web_queries" in result and "github_query" in result:
                if "required_apis" not in result:
                    result["required_apis"] = []
                return result
        except Exception:
            pass

        return {
            "web_queries": [f"{idea} tool service app", f"{idea} alternative competitor"],
            "github_query": idea,
            "required_apis": [],
        }

    # ──────────────────────────────────────────────────────
    # Step 1 & 2: Search (parallel)
    # ──────────────────────────────────────────────────────

    async def _search_web(self, idea: str, ai_queries: list[str] | None = None) -> dict:
        """Search web for competitors using Tavily API with AI-optimized queries."""
        if not self.tavily_api_key:
            return {"competitors": [], "summary": "검색 API 키가 설정되지 않았습니다.", "raw_count": 0}

        query1 = ai_queries[0] if ai_queries and len(ai_queries) > 0 else f"{idea} tool service app"
        query2 = ai_queries[1] if ai_queries and len(ai_queries) > 1 else f"{idea} alternative competitor similar"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp1, resp2 = await asyncio.gather(
                    client.post("https://api.tavily.com/search", json={
                        "api_key": self.tavily_api_key, "query": query1,
                        "max_results": 8, "search_depth": "basic",
                    }),
                    client.post("https://api.tavily.com/search", json={
                        "api_key": self.tavily_api_key, "query": query2,
                        "max_results": 5, "search_depth": "basic",
                    }),
                )

                competitors = []
                seen_urls = set()
                for resp in [resp1, resp2]:
                    for r in resp.json().get("results", []):
                        url = r.get("url", "")
                        if url not in seen_urls:
                            seen_urls.add(url)
                            competitors.append({
                                "title": r.get("title", ""),
                                "url": url,
                                "snippet": r.get("content", "")[:200],
                            })

                return {
                    "competitors": competitors[:10],
                    "raw_count": len(competitors),
                    "summary": f"웹에서 {len(competitors)}개의 관련 결과를 발견했습니다.",
                }
        except Exception as e:
            return {"competitors": [], "summary": f"검색 중 오류: {str(e)}", "raw_count": 0}

    async def _search_github(self, idea: str, ai_query: str = "") -> dict:
        """Search GitHub for similar projects with AI-optimized query."""
        try:
            headers = {"Accept": "application/vnd.github.v3+json"}
            if self.github_token:
                headers["Authorization"] = f"token {self.github_token}"

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

    # ──────────────────────────────────────────────────────
    # Relevance filtering: AI removes irrelevant search results
    # ──────────────────────────────────────────────────────

    async def _filter_relevance(self, idea: str, competitors: dict, github_results: dict) -> dict:
        """Use Claude to filter out irrelevant search results."""
        if not self.anthropic_client:
            return {"competitors": competitors, "github": github_results}

        comp_list = competitors.get("competitors", [])[:10]
        repo_list = github_results.get("repos", [])[:10]

        if not comp_list and not repo_list:
            return {"competitors": competitors, "github": github_results}

        items_text = ""
        for i, c in enumerate(comp_list):
            items_text += f"WEB_{i}: {c['title']} — {c['snippet'][:100]}\n"
        for i, r in enumerate(repo_list):
            items_text += f"GH_{i}: {r['name']} — {r['description'][:100]}\n"

        prompt = f"""아이디어: {idea}

아래 검색 결과 중 이 아이디어와 실제로 관련된 경쟁 제품/유사 프로젝트만 선별하세요.
뉴스 기사, 튜토리얼, 관련 없는 도구는 제외하세요.

{items_text}

반드시 순수 JSON으로만 응답하세요:
{{
  "relevant_web": [0, 2, 5],
  "relevant_gh": [0, 1, 3]
}}

숫자는 위 목록의 인덱스입니다. 관련 있는 것만 포함하세요."""

        try:
            response = await self.anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=256,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
            result = self._parse_json_safe(text, {})

            relevant_web = result.get("relevant_web", list(range(len(comp_list))))
            relevant_gh = result.get("relevant_gh", list(range(len(repo_list))))

            filtered_comps = [comp_list[i] for i in relevant_web if i < len(comp_list)]
            filtered_repos = [repo_list[i] for i in relevant_gh if i < len(repo_list)]

            filtered_competitors = {
                "competitors": filtered_comps,
                "raw_count": competitors.get("raw_count", 0),
                "filtered_count": len(filtered_comps),
                "summary": f"{competitors.get('raw_count', 0)}개 중 {len(filtered_comps)}개가 실제 경쟁 제품으로 확인됨",
            }
            filtered_github = {
                "repos": filtered_repos,
                "total_count": github_results.get("total_count", 0),
                "filtered_count": len(filtered_repos),
                "summary": f"{github_results.get('total_count', 0)}개 중 {len(filtered_repos)}개가 실제 유사 프로젝트로 확인됨",
            }

            return {"competitors": filtered_competitors, "github": filtered_github}
        except Exception:
            return {"competitors": competitors, "github": github_results}

    # ──────────────────────────────────────────────────────
    # API / Data source verification
    # ──────────────────────────────────────────────────────

    async def _check_data_sources(self, idea: str, required_apis: list[dict]) -> dict:
        """Verify API/data source availability by actually checking URLs."""
        results = []

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            for api in required_apis:
                check = {
                    "name": api.get("name", ""),
                    "purpose": api.get("purpose", ""),
                    "known_blocked": api.get("known_blocked", False),
                    "alternatives": api.get("alternatives", []),
                    "status": "unknown",
                    "detail": "",
                }

                if api.get("known_blocked"):
                    check["status"] = "blocked"
                    check["detail"] = "크롤링/API 접근이 차단된 것으로 알려진 서비스"
                    results.append(check)
                    continue

                check_url = api.get("check_url", "")
                if check_url:
                    try:
                        resp = await client.head(check_url)
                        if resp.status_code < 400:
                            check["status"] = "available"
                            check["detail"] = f"API 문서 확인됨 (HTTP {resp.status_code})"
                        else:
                            check["status"] = "uncertain"
                            check["detail"] = f"API 문서 접근 불가 (HTTP {resp.status_code})"
                    except Exception:
                        check["status"] = "uncertain"
                        check["detail"] = "API 문서 URL에 접근할 수 없음"
                else:
                    check["status"] = "no_docs"
                    check["detail"] = "공식 API 문서 URL을 찾을 수 없음"

                results.append(check)

        blocked_count = sum(1 for r in results if r["status"] == "blocked")
        uncertain_count = sum(1 for r in results if r["status"] in ("uncertain", "no_docs"))
        total = len(results)

        if total == 0:
            risk_level = "low"
            risk_score = 0
        elif blocked_count > 0:
            risk_level = "critical"
            risk_score = min(100, blocked_count * 40 + uncertain_count * 15)
        elif uncertain_count > 0:
            risk_level = "moderate"
            risk_score = min(80, uncertain_count * 20)
        else:
            risk_level = "low"
            risk_score = 0

        return {
            "checks": results,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "summary": self._build_api_check_summary(results),
        }

    def _build_api_check_summary(self, results: list[dict]) -> str:
        if not results:
            return "특별한 외부 데이터 소스가 필요하지 않습니다."
        blocked = [r["name"] for r in results if r["status"] == "blocked"]
        available = [r["name"] for r in results if r["status"] == "available"]
        parts = []
        if blocked:
            parts.append(f"접근 차단: {', '.join(blocked)}")
        if available:
            parts.append(f"사용 가능: {', '.join(available)}")
        return " | ".join(parts) if parts else "데이터 소스 확인 완료"

    # ──────────────────────────────────────────────────────
    # Claude streaming wrapper
    # ──────────────────────────────────────────────────────

    async def _call_claude_stream(self, prompt: str, fallback: dict, max_tokens: int = 1024) -> AsyncGenerator[dict, None]:
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
                    if char_count >= 80:
                        char_count = 0
                        yield {"type": "progress", "text": f"AI 응답 생성 중... ({len(collected_text)}자)"}
            result = self._parse_json_safe(collected_text.strip(), fallback)
            yield {"type": "result", "result": result}
        except Exception:
            yield {"type": "result", "result": fallback}

    # ──────────────────────────────────────────────────────
    # Step 3: Feasibility (with real competitor data + API checks)
    # ──────────────────────────────────────────────────────

    async def _stream_feasibility(self, idea: str, mode: str, filtered: dict, api_check: dict) -> AsyncGenerator[dict, None]:
        fallback = self._fallback_feasibility(idea)
        prompt = self._build_feasibility_prompt(idea, mode, filtered, api_check)
        async for event in self._call_claude_stream(prompt, fallback, max_tokens=1500):
            yield event

    def _build_feasibility_prompt(self, idea: str, mode: str, filtered: dict, api_check: dict) -> str:
        mode_context = {
            "hackathon": "4시간 해커톤 (1인 개발자)",
            "startup": "초기 스타트업 (3-5명 팀, 3개월)",
            "sideproject": "사이드 프로젝트 (1-2명, 주말 개발)",
        }
        competitors = filtered.get("competitors", {})
        github = filtered.get("github", {})

        comp_detail = "\n".join(
            [f"- {c['title']}: {c['snippet']}" for c in competitors.get("competitors", [])[:5]]
        ) or "관련 경쟁 제품 없음"

        gh_detail = "\n".join(
            [f"- {r['name']} ({r.get('language', '?')}, ⭐{r['stars']}): {r['description']}"
             for r in github.get("repos", [])[:5]]
        ) or "관련 오픈소스 없음"

        api_detail = ""
        if api_check.get("checks"):
            api_lines = []
            for check in api_check["checks"]:
                status_emoji = {"available": "✅", "blocked": "🚫", "uncertain": "⚠️", "no_docs": "❓"}.get(check["status"], "❓")
                alt_text = f" (대안: {', '.join(check['alternatives'])})" if check["alternatives"] else ""
                api_lines.append(f"  {status_emoji} {check['name']}: {check['detail']}{alt_text}")
            api_detail = "\n".join(api_lines)
        else:
            api_detail = "  특별한 외부 API 불필요"

        return f"""당신은 기술 실현성을 냉정하게 분석하는 시니어 개발자입니다.
특히 데이터 소스 접근 가능성을 실제로 검증한 결과가 포함되어 있으니 반드시 반영하세요.

아이디어: {idea}
개발 환경: {mode_context.get(mode, mode_context["hackathon"])}

■ 실제 검색된 경쟁 제품 ({competitors.get("filtered_count", competitors.get("raw_count", 0))}개 확인됨):
{comp_detail}

■ 실제 검색된 GitHub 유사 프로젝트 ({github.get("filtered_count", github.get("total_count", 0))}개 확인됨):
{gh_detail}

■ 데이터 소스/API 접근성 검증 결과 (위험도: {api_check.get("risk_level", "unknown")}):
{api_detail}

중요: 🚫로 표시된 API는 실제로 접근이 차단되었으므로, 이 아이디어의 핵심 기능에 영향을 미칩니다.
대안이 있다면 대안 기반의 구현 가능성도 평가하세요.

반드시 순수 JSON으로만 응답하세요:

{{
  "overall_feasibility": "possible" | "partial" | "difficult",
  "score": 0-100,
  "tech_requirements": [
    {{"name": "기술/API명", "available": true/false, "difficulty": "easy|medium|hard", "note": "한줄 설명 (차단된 경우 대안 명시)"}}
  ],
  "key_risks": ["리스크 1 (구체적으로)", "리스크 2"],
  "data_source_risks": ["데이터 접근 관련 구체적 리스크"],
  "time_estimate": "예상 개발 시간",
  "summary": "한줄 종합 판단"
}}"""

    # ──────────────────────────────────────────────────────
    # Step 4: Differentiation (with full filtered data)
    # ──────────────────────────────────────────────────────

    async def _stream_differentiation(self, idea: str, filtered: dict) -> AsyncGenerator[dict, None]:
        competitors = filtered.get("competitors", {})
        github = filtered.get("github", {})
        fallback = self._fallback_differentiation(idea, competitors, github)
        prompt = self._build_differentiation_prompt(idea, filtered)
        async for event in self._call_claude_stream(prompt, fallback, max_tokens=1500):
            yield event

    def _build_differentiation_prompt(self, idea: str, filtered: dict) -> str:
        competitors = filtered.get("competitors", {})
        github = filtered.get("github", {})

        competitor_list = "\n".join(
            [f"- {c['title']}: {c['snippet']}" for c in competitors.get("competitors", [])[:7]]
        ) or "관련 경쟁 제품 없음"

        github_list = "\n".join(
            [f"- {r['name']} ({r.get('language', '?')}, ⭐{r['stars']}): {r['description']}"
             for r in github.get("repos", [])[:7]]
        ) or "관련 유사 프로젝트 없음"

        filter_note = ""
        raw_web = competitors.get("raw_count", 0)
        filtered_web = competitors.get("filtered_count", raw_web)
        if raw_web != filtered_web:
            filter_note = f"\n참고: 웹 검색 {raw_web}건 중 {filtered_web}건만 실제 경쟁 제품으로 확인됨 (나머지는 뉴스/기사 등)"

        return f"""당신은 Devil's Advocate입니다. 아이디어의 차별화 가능성을 냉정하게 분석하세요.

아이디어: {idea}
{filter_note}

■ 실제 경쟁 제품 (관련성 검증 완료):
{competitor_list}

■ GitHub 유사 프로젝트 (관련성 검증 완료):
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

    # ──────────────────────────────────────────────────────
    # Step 5: Verdict (with ALL analysis data — full context)
    # ──────────────────────────────────────────────────────

    async def _stream_verdict(self, idea: str, mode: str, filtered: dict, feasibility: dict, differentiation: dict, api_check: dict) -> AsyncGenerator[dict, None]:
        fallback = self._fallback_verdict(feasibility, differentiation)
        prompt = self._build_verdict_prompt(idea, mode, filtered, feasibility, differentiation, api_check)
        async for event in self._call_claude_stream(prompt, fallback, max_tokens=1500):
            yield event

    def _build_verdict_prompt(self, idea: str, mode: str, filtered: dict, feasibility: dict, differentiation: dict, api_check: dict) -> str:
        competitors = filtered.get("competitors", {})
        github = filtered.get("github", {})

        tech_reqs = "\n".join(
            [f"  - {t['name']}: {'✅' if t.get('available') else '❌'} ({t.get('difficulty', '?')}) {t.get('note', '')}"
             for t in feasibility.get("tech_requirements", [])]
        ) or "  정보 없음"

        existing = "\n".join(
            [f"  - {s['name']}: 유사도 {s.get('similarity', '?')}%, 약점: {s.get('weakness', '?')}"
             for s in differentiation.get("existing_solutions", [])]
        ) or "  정보 없음"

        api_summary = ""
        blocked_apis = [c for c in api_check.get("checks", []) if c["status"] == "blocked"]
        if blocked_apis:
            api_summary = "\n■ 데이터 접근 차단:\n" + "\n".join(
                [f"  - {a['name']}: {a['detail']} (대안: {', '.join(a.get('alternatives', ['없음']))})"
                 for a in blocked_apis]
            )
            api_summary += f"\n  → 데이터 소스 위험도: {api_check.get('risk_level', '?')} (점수: {api_check.get('risk_score', 0)})"

        return f"""당신은 해커톤 아이디어 심판관입니다. 아래의 모든 분석 데이터를 교차 검증하여 최종 판정을 내리세요.

아이디어: {idea}
모드: {mode}

■ 경쟁 현황:
- 실제 경쟁 제품: {competitors.get("filtered_count", competitors.get("raw_count", 0))}개
- GitHub 유사 프로젝트: {github.get("filtered_count", github.get("total_count", 0))}개
- 경쟁 수준: {differentiation.get("competition_level", "unknown")}
- 경쟁 점수: {differentiation.get("competition_score", "?")}/100

■ 기존 솔루션 상세:
{existing}

■ 기술 실현성:
- 점수: {feasibility.get("score", 50)}/100
- 판정: {feasibility.get("overall_feasibility", "unknown")}
- 필요 기술:
{tech_reqs}
- 핵심 리스크: {json.dumps(feasibility.get("key_risks", []), ensure_ascii=False)}
- 데이터 소스 리스크: {json.dumps(feasibility.get("data_source_risks", []), ensure_ascii=False)}
{api_summary}

■ 차별화:
- 차별화 포인트: {json.dumps(differentiation.get("unique_angles", []), ensure_ascii=False)}
- Devil's Arguments: {json.dumps(differentiation.get("devil_arguments", []), ensure_ascii=False)}
- 피벗 제안: {json.dumps(differentiation.get("pivot_suggestions", []), ensure_ascii=False)}

교차 검증 지침:
1. feasibility score와 competition_score가 모순되지 않는지 확인
2. 데이터 소스가 차단된 경우 feasibility 점수를 대폭 하향 조정
3. timing 점수는 경쟁 제품의 최신성과 GitHub 프로젝트 활동으로 판단
4. overall_score는 개별 점수의 단순 평균이 아닌, 가중 평가

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

    # ──────────────────────────────────────────────────────
    # Utilities
    # ──────────────────────────────────────────────────────

    def _parse_json_safe(self, text: str, fallback: dict) -> dict:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        if "```" in text:
            try:
                json_str = text.split("```")[1]
                if json_str.startswith("json"):
                    json_str = json_str[4:]
                return json.loads(json_str.strip())
            except (json.JSONDecodeError, IndexError):
                pass
        try:
            start = text.index("{")
            end = text.rindex("}") + 1
            return json.loads(text[start:end])
        except (ValueError, json.JSONDecodeError):
            pass
        return fallback

    # ──────────────────────────────────────────────────────
    # Fallbacks
    # ──────────────────────────────────────────────────────

    def _fallback_feasibility(self, idea: str) -> dict:
        return {
            "overall_feasibility": "partial",
            "score": 50,
            "tech_requirements": [],
            "key_risks": ["LLM 분석 실패 — fallback 데이터입니다"],
            "data_source_risks": [],
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
