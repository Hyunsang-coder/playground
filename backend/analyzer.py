import json
import asyncio
import re
from typing import AsyncGenerator
from urllib.parse import quote

import httpx
import anthropic


# --- Constants ---

VALID_MODES = {"hackathon", "startup", "sideproject"}
MAX_IDEA_LENGTH = 500

MODE_CONTEXT = {
    "hackathon": "4시간 해커톤 (1인 개발자, 빠른 프로토타이핑 필요)",
    "startup": "초기 스타트업 (3-5명 팀, 3개월 개발 기간)",
    "sideproject": "사이드 프로젝트 (1-2명, 주말/야간 개발)",
}

MODE_TIME_CONSTRAINTS = {
    "hackathon": "4시간 이내",
    "startup": "3개월 이내",
    "sideproject": "2-3개월 (주말만)",
}

# Score weights for final verdict
SCORE_WEIGHTS = {
    "competition": 0.20,
    "feasibility": 0.35,
    "differentiation": 0.25,
    "timing": 0.20,
}

# If any category score is below this, verdict cannot be GO
CATEGORY_MINIMUM_FOR_GO = 25


class IdeaAnalyzer:
    def __init__(self, anthropic_api_key: str, github_token: str = ""):
        self.anthropic_client = anthropic.AsyncAnthropic(api_key=anthropic_api_key) if anthropic_api_key else None
        self.github_token = github_token

    # ── Input Validation ──────────────────────────────────────────

    @staticmethod
    def validate_input(idea: str, mode: str) -> tuple[str, str, list[str]]:
        """Validate and sanitize input. Returns (sanitized_idea, validated_mode, errors)."""
        errors = []

        idea = idea.strip()
        if not idea:
            errors.append("아이디어를 입력해주세요.")
        elif len(idea) > MAX_IDEA_LENGTH:
            idea = idea[:MAX_IDEA_LENGTH]

        if mode not in VALID_MODES:
            mode = "hackathon"

        return idea, mode, errors

    @staticmethod
    def _sanitize_query(text: str, max_length: int = 128) -> str:
        """Sanitize text for use in API queries."""
        sanitized = re.sub(r'[^\w\s가-힣\-]', ' ', text)
        sanitized = re.sub(r'\s+', ' ', sanitized).strip()
        return sanitized[:max_length]

    # ── Main Pipeline ─────────────────────────────────────────────

    async def analyze(self, idea: str, mode: str) -> AsyncGenerator[dict, None]:
        """Main analysis pipeline — streams SSE events step by step."""

        idea, mode, errors = self.validate_input(idea, mode)
        if errors:
            yield {"event": "error", "data": {"message": errors[0]}}
            return

        # Step 1: Web search for competitors
        yield {"event": "step_start", "data": {"step": 1, "title": "경쟁 제품 탐색", "description": "웹에서 유사 서비스를 검색하고 있습니다..."}}
        await asyncio.sleep(0.3)

        competitors = await self._search_web(idea)
        yield {"event": "step_result", "data": {"step": 1, "result": competitors}}

        # Step 2: GitHub search (multi-strategy)
        yield {"event": "step_start", "data": {"step": 2, "title": "GitHub 유사 프로젝트 심층 탐색", "description": "다중 전략으로 유사 오픈소스를 분석하고 있습니다..."}}
        await asyncio.sleep(0.3)

        github_results = await self._search_github(idea)
        yield {"event": "step_result", "data": {"step": 2, "result": github_results}}

        # Step 3: Technical feasibility (deep analysis)
        yield {"event": "step_start", "data": {"step": 3, "title": "기술 실현성 심층 분석", "description": "기술 스택, API 의존성, 구현 복잡도를 분석하고 있습니다..."}}
        await asyncio.sleep(0.3)

        feasibility = await self._analyze_feasibility(idea, mode, competitors, github_results)
        yield {"event": "step_result", "data": {"step": 3, "result": feasibility}}

        # Step 4: Differentiation (deep competitor comparison)
        yield {"event": "step_start", "data": {"step": 4, "title": "차별화 심층 분석", "description": "경쟁 제품 및 GitHub 프로젝트 코드 기반 비교 분석 중..."}}
        await asyncio.sleep(0.3)

        differentiation = await self._analyze_differentiation(idea, mode, competitors, github_results)
        yield {"event": "step_result", "data": {"step": 4, "result": differentiation}}

        # Step 5: Final verdict (weighted scoring + category minimums)
        yield {"event": "step_start", "data": {"step": 5, "title": "종합 판정", "description": "가중 점수 및 카테고리별 최소 기준으로 판정 중..."}}
        await asyncio.sleep(0.3)

        verdict = await self._generate_verdict(idea, mode, competitors, github_results, feasibility, differentiation)
        yield {"event": "step_result", "data": {"step": 5, "result": verdict}}

        yield {"event": "done", "data": {"message": "분석 완료"}}

    # ── Step 1: Web Search (Claude web_search) ─────────────────────

    async def _search_web(self, idea: str) -> dict:
        """Search web for competitors using Claude's built-in web_search tool."""
        if not self.anthropic_client:
            return {"competitors": [], "summary": "API 키가 설정되지 않았습니다.", "raw_count": 0}

        try:
            response = await self.anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                tools=[{
                    "type": "web_search_20250305",
                    "name": "web_search",
                    "max_uses": 5,
                }],
                messages=[{
                    "role": "user",
                    "content": f"""다음 아이디어와 유사하거나 경쟁이 되는 서비스/제품/도구를 웹에서 검색하세요.

아이디어: {idea}

검색 후 발견한 경쟁 제품들을 반드시 순수 JSON으로만 응답하세요:

{{
  "competitors": [
    {{"title": "제품/서비스명", "url": "URL", "snippet": "한줄 설명 (200자 이내)"}}
  ],
  "raw_count": 발견된 경쟁 제품 수,
  "summary": "검색 결과 요약 한줄"
}}""",
                }],
            )

            # Extract text blocks and search result URLs
            text_parts = []
            search_urls: list[dict] = []

            for block in response.content:
                if block.type == "text":
                    text_parts.append(block.text)
                elif block.type == "web_search_tool_result":
                    for item in getattr(block, "content", []):
                        url = getattr(item, "url", "")
                        title = getattr(item, "title", "")
                        if url:
                            search_urls.append({"title": title, "url": url})

            full_text = "\n".join(text_parts).strip()

            # Try parsing Claude's structured JSON response
            fallback = {"competitors": [], "summary": "검색 결과 파싱 실패", "raw_count": 0}
            result = self._parse_json_safe(full_text, fallback)

            # Supplement with raw search URLs that Claude might have missed
            if result is not fallback:
                existing_urls = {c.get("url") for c in result.get("competitors", [])}
                for su in search_urls:
                    if su["url"] not in existing_urls and len(result.get("competitors", [])) < 10:
                        result["competitors"].append({**su, "snippet": ""})
                result["raw_count"] = len(result.get("competitors", []))
                return result

            # Fallback: use raw search URLs directly
            competitors = [{"title": u["title"], "url": u["url"], "snippet": ""} for u in search_urls[:10]]
            return {
                "competitors": competitors,
                "raw_count": len(competitors),
                "summary": f"웹에서 {len(competitors)}개의 관련 결과를 발견했습니다.",
            }
        except Exception as e:
            return {"competitors": [], "summary": f"검색 중 오류: {str(e)}", "raw_count": 0}

    # ── Step 2: GitHub Search (Enhanced) ──────────────────────────

    async def _search_github(self, idea: str) -> dict:
        """Multi-strategy GitHub search with repo detail enrichment."""
        try:
            headers = {"Accept": "application/vnd.github.v3+json"}
            if self.github_token:
                headers["Authorization"] = f"token {self.github_token}"

            query = self._sanitize_query(idea)

            async with httpx.AsyncClient(timeout=15.0) as client:
                # Run 3 search strategies in parallel
                search_tasks = [
                    self._github_search_query(client, headers, query, sort="stars", per_page=10),
                    self._github_search_query(client, headers, query, sort="updated", per_page=5),
                    self._github_search_query(client, headers, f"{query} in:readme,description", sort="stars", per_page=5),
                ]

                results = await asyncio.gather(*search_tasks, return_exceptions=True)

                # Deduplicate by full_name
                seen: set[str] = set()
                all_repos = []
                total_count = 0
                strategy_names = ["키워드 검색", "최근 활동 검색", "README/설명 검색"]
                strategies_used = []

                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        continue
                    strategies_used.append(strategy_names[i])
                    total_count = max(total_count, result.get("total_count", 0))

                    for item in result.get("items", []):
                        name = item.get("full_name", "")
                        if name and name not in seen:
                            seen.add(name)
                            all_repos.append(item)

                # Sort by stars descending
                all_repos.sort(key=lambda x: x.get("stargazers_count", 0), reverse=True)
                top_repos = all_repos[:10]

                # Fetch details for top 5 repos in parallel
                detail_tasks = [
                    self._fetch_repo_details(client, repo, headers)
                    for repo in top_repos[:5]
                ]
                enriched_details = await asyncio.gather(*detail_tasks, return_exceptions=True)

                enriched_repos = []
                for i, repo in enumerate(top_repos):
                    base = {
                        "name": repo.get("full_name", ""),
                        "description": (repo.get("description") or "")[:200],
                        "stars": repo.get("stargazers_count", 0),
                        "url": repo.get("html_url", ""),
                        "language": repo.get("language", ""),
                        "updated": repo.get("updated_at", "")[:10],
                        "topics": repo.get("topics", [])[:8],
                        "forks": repo.get("forks_count", 0),
                        "open_issues": repo.get("open_issues_count", 0),
                        "readme_snippet": "",
                        "recent_commits": 0,
                        "last_commit_date": "",
                    }

                    if i < 5 and not isinstance(enriched_details[i], Exception):
                        details = enriched_details[i]
                        base["readme_snippet"] = details.get("readme_snippet", "")
                        base["recent_commits"] = details.get("recent_commits", 0)
                        base["last_commit_date"] = details.get("last_commit_date", "")

                    enriched_repos.append(base)

                return {
                    "repos": enriched_repos,
                    "total_count": total_count,
                    "strategies_used": strategies_used,
                    "summary": f"GitHub에서 {total_count}개의 관련 저장소를 발견했습니다. ({', '.join(strategies_used)})",
                }
        except Exception as e:
            return {"repos": [], "total_count": 0, "strategies_used": [], "summary": f"GitHub 검색 중 오류: {str(e)}"}

    async def _github_search_query(self, client: httpx.AsyncClient, headers: dict, query: str, sort: str = "stars", per_page: int = 10) -> dict:
        """Execute a single GitHub search query with URL-safe encoding."""
        encoded_q = quote(query)
        resp = await client.get(
            f"https://api.github.com/search/repositories?q={encoded_q}&sort={sort}&order=desc&per_page={per_page}",
            headers=headers,
        )
        if resp.status_code == 403:
            return {"items": [], "total_count": 0}
        return resp.json()

    async def _fetch_repo_details(self, client: httpx.AsyncClient, repo: dict, headers: dict) -> dict:
        """Fetch README and recent commit activity for a repository."""
        full_name = repo.get("full_name", "")
        result = {"readme_snippet": "", "recent_commits": 0, "last_commit_date": ""}

        if not full_name:
            return result

        try:
            readme_task = client.get(
                f"https://api.github.com/repos/{full_name}/readme",
                headers={**headers, "Accept": "application/vnd.github.v3.raw"},
            )
            commits_task = client.get(
                f"https://api.github.com/repos/{full_name}/commits?per_page=5",
                headers=headers,
            )

            readme_resp, commits_resp = await asyncio.gather(
                readme_task, commits_task, return_exceptions=True
            )

            if not isinstance(readme_resp, Exception) and readme_resp.status_code == 200:
                readme_text = readme_resp.text[:1500]
                readme_clean = re.sub(r'[#*`\[\]()]', '', readme_text)
                readme_clean = re.sub(r'\s+', ' ', readme_clean).strip()
                result["readme_snippet"] = readme_clean[:300]

            if not isinstance(commits_resp, Exception) and commits_resp.status_code == 200:
                commits = commits_resp.json()
                result["recent_commits"] = len(commits)
                if commits:
                    result["last_commit_date"] = commits[0].get("commit", {}).get("committer", {}).get("date", "")[:10]
        except Exception:
            pass

        return result

    # ── Step 3: Feasibility Analysis (Enhanced) ───────────────────

    async def _analyze_feasibility(self, idea: str, mode: str, competitors: dict, github_results: dict) -> dict:
        """Deep technical feasibility analysis with tech stack decomposition."""
        if not self.anthropic_client:
            return self._fallback_feasibility(idea, mode, github_results)

        # Build context from GitHub findings
        github_context = ""
        for repo in github_results.get("repos", [])[:5]:
            parts = []
            if repo.get("language"):
                parts.append(f"언어: {repo['language']}")
            if repo.get("topics"):
                parts.append(f"토픽: {', '.join(repo['topics'][:5])}")
            if repo.get("readme_snippet"):
                parts.append(f"README: {repo['readme_snippet'][:150]}")
            if repo.get("recent_commits", 0) > 0:
                parts.append(f"최근 커밋 {repo['recent_commits']}개 (마지막: {repo.get('last_commit_date', 'N/A')})")
            github_context += f"- {repo.get('name', '')} (⭐{repo.get('stars', 0)}, 포크 {repo.get('forks', 0)}): {'; '.join(parts)}\n"

        prompt = f"""당신은 기술 실현성을 냉정하게 평가하는 시니어 풀스택 개발자입니다.

아이디어: {idea}
개발 환경: {MODE_CONTEXT.get(mode, MODE_CONTEXT["hackathon"])}
시간 제약: {MODE_TIME_CONSTRAINTS.get(mode, "4시간 이내")}

경쟁 현황:
- 웹 검색 결과: {competitors.get("raw_count", 0)}개 경쟁 제품
- GitHub 유사 프로젝트: {github_results.get("total_count", 0)}개

유사 GitHub 프로젝트 기술 스택:
{github_context or "발견된 유사 프로젝트 없음"}

다음을 구체적으로 분석하세요:
1. 핵심 기능 분해: 이 아이디어를 구현하려면 어떤 기능 모듈이 필요한지
2. 기술 스택: 각 모듈에 필요한 구체적 기술/API/라이브러리
3. 구현 난이도: 각 기술의 실제 사용 가능 여부와 난이도
4. 시간 제약 대비 실현성: 주어진 {MODE_TIME_CONSTRAINTS.get(mode, "4시간")} 안에 MVP가 가능한지
5. 외부 API 의존도: 외부 API 의존 수준과 대안 여부
6. 필요 스킬 레벨: 어느 수준의 개발자가 필요한지

반드시 순수 JSON으로만 응답하세요:

{{
  "overall_feasibility": "possible" | "partial" | "difficult",
  "score": 0-100,
  "tech_requirements": [
    {{"name": "기술/API명", "available": true/false, "difficulty": "easy" | "medium" | "hard", "note": "한줄 설명", "alternatives": "대안 기술 (있다면)"}}
  ],
  "implementation_steps": [
    {{"step": "구현 단계명", "estimated_hours": 0.5, "complexity": "low" | "medium" | "high", "description": "구체적 설명"}}
  ],
  "required_apis": [
    {{"name": "API명", "purpose": "용도", "free_tier": true/false, "rate_limit_concern": true/false, "alternative": "대안 API"}}
  ],
  "complexity_breakdown": {{
    "frontend": "low" | "medium" | "high",
    "backend": "low" | "medium" | "high",
    "ai_ml": "none" | "low" | "medium" | "high",
    "data": "low" | "medium" | "high",
    "infra": "low" | "medium" | "high"
  }},
  "key_risks": ["구체적 리스크 1", "리스크 2"],
  "time_estimate": "예상 최소 개발 시간",
  "time_feasible": true/false,
  "skill_level": "junior" | "mid" | "senior" | "expert",
  "summary": "한줄 종합 판단"
}}"""

        try:
            response = await self.anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
            result = self._parse_json_safe(text, self._fallback_feasibility(idea, mode, github_results))
            return self._validate_feasibility(result)
        except Exception:
            return self._fallback_feasibility(idea, mode, github_results)

    # ── Step 4: Differentiation Analysis (Enhanced) ───────────────

    async def _analyze_differentiation(self, idea: str, mode: str, competitors: dict, github_results: dict) -> dict:
        """Deep differentiation analysis using enriched competitor + GitHub data."""
        if not self.anthropic_client:
            return self._fallback_differentiation(idea, competitors, github_results)

        # Build rich competitor context
        competitor_context = ""
        for c in competitors.get("competitors", [])[:5]:
            competitor_context += f"- [{c['title']}]({c['url']}): {c['snippet']}\n"
        competitor_context = competitor_context or "발견된 경쟁 제품 없음"

        # Build rich GitHub context with README
        github_context = ""
        for r in github_results.get("repos", [])[:5]:
            parts = [f"⭐{r.get('stars', 0)}"]
            if r.get("language"):
                parts.append(r["language"])
            if r.get("topics"):
                parts.append(f"토픽: {', '.join(r['topics'][:3])}")
            if r.get("forks", 0) > 0:
                parts.append(f"포크 {r['forks']}개")
            if r.get("recent_commits", 0) > 0:
                parts.append(f"최근 커밋 {r['recent_commits']}개")
            desc = r.get("description", "") or ""
            readme = r.get("readme_snippet", "")
            github_context += f"- {r.get('name', '')} ({', '.join(parts)})\n"
            if desc:
                github_context += f"  설명: {desc[:100]}\n"
            if readme:
                github_context += f"  README: {readme[:150]}\n"
        github_context = github_context or "발견된 유사 프로젝트 없음"

        prompt = f"""당신은 Devil's Advocate이자 시장 분석 전문가입니다. 아이디어의 차별화 가능성을 냉정하게 평가하세요.

아이디어: {idea}
개발 모드: {MODE_CONTEXT.get(mode, MODE_CONTEXT["hackathon"])}

경쟁 제품 ({competitors.get("raw_count", 0)}개 발견):
{competitor_context}

GitHub 유사 프로젝트 ({github_results.get("total_count", 0)}개 발견):
{github_context}

다음을 분석하세요:
1. 각 경쟁 제품/프로젝트와의 구체적 유사도 (기능 단위로 비교)
2. 기존 솔루션의 구체적 약점 (이 아이디어가 파고들 틈)
3. 레드오션/블루오션 판단 근거
4. Devil's Advocate: 최소 3가지 "이 아이디어가 실패하는 구체적 이유"
5. 차별화 가능 포인트: 기존 대비 뚜렷한 차별점
6. GitHub 프로젝트 활성도 분석: 유사 프로젝트가 활발히 관리되고 있는지

반드시 순수 JSON으로만 응답하세요:

{{
  "competition_level": "blue_ocean" | "moderate" | "red_ocean",
  "competition_score": 0-100,
  "existing_solutions": [
    {{
      "name": "제품/프로젝트명",
      "similarity": 0-100,
      "weakness": "구체적 약점",
      "is_active": true/false,
      "overlap_features": ["겹치는 기능 1", "기능 2"]
    }}
  ],
  "unique_angles": ["차별화 포인트 1", "차별화 포인트 2"],
  "devil_arguments": ["이 아이디어가 실패하는 구체적 이유 1", "이유 2", "이유 3"],
  "market_gap": "기존 솔루션이 놓치고 있는 구체적 틈새",
  "pivot_suggestions": ["대안 아이디어 1", "대안 아이디어 2"],
  "summary": "한줄 종합"
}}"""

        try:
            response = await self.anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
            result = self._parse_json_safe(text, self._fallback_differentiation(idea, competitors, github_results))
            return self._validate_differentiation(result)
        except Exception:
            return self._fallback_differentiation(idea, competitors, github_results)

    # ── Step 5: Verdict (Enhanced) ────────────────────────────────

    async def _generate_verdict(self, idea: str, mode: str, competitors: dict, github_results: dict, feasibility: dict, differentiation: dict) -> dict:
        """Final verdict with weighted scoring and category minimums."""
        if not self.anthropic_client:
            return self._fallback_verdict(feasibility, differentiation)

        prompt = f"""당신은 해커톤 아이디어 심판관입니다. 모든 분석 결과를 종합하여 최종 판정을 내리세요.

아이디어: {idea}
모드: {MODE_CONTEXT.get(mode, MODE_CONTEXT["hackathon"])}

=== 분석 결과 ===

[경쟁 현황]
- 웹 경쟁 제품: {competitors.get("raw_count", 0)}개
- GitHub 유사 프로젝트: {github_results.get("total_count", 0)}개
- 경쟁 수준: {differentiation.get("competition_level", "unknown")}
- 주요 경쟁자: {json.dumps([s.get("name", "") for s in differentiation.get("existing_solutions", [])[:3]], ensure_ascii=False)}

[기술 실현성]
- 점수: {feasibility.get("score", 50)}/100
- 판정: {feasibility.get("overall_feasibility", "unknown")}
- 시간 내 구현 가능: {feasibility.get("time_feasible", "unknown")}
- 필요 스킬: {feasibility.get("skill_level", "unknown")}
- 핵심 리스크: {json.dumps(feasibility.get("key_risks", []), ensure_ascii=False)}
- 복잡도: {json.dumps(feasibility.get("complexity_breakdown", {}), ensure_ascii=False)}

[차별화]
- 경쟁 점수: {differentiation.get("competition_score", 50)}/100
- Devil's Arguments: {json.dumps(differentiation.get("devil_arguments", []), ensure_ascii=False)}
- 차별화 포인트: {json.dumps(differentiation.get("unique_angles", []), ensure_ascii=False)}
- 시장 틈새: {differentiation.get("market_gap", "N/A")}

=== 판정 기준 ===
- 점수 가중치: 경쟁(20%), 실현성(35%), 차별화(25%), 타이밍(20%)
- GO: 가중 평균 70+ AND 모든 카테고리 25+
- PIVOT: 가중 평균 40-69 OR 특정 카테고리 25 미만
- KILL: 가중 평균 40 미만

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
  "strengths": ["강점 1", "강점 2"],
  "weaknesses": ["약점 1", "약점 2"],
  "alternative_ideas": ["대안 1", "대안 2", "대안 3"]
}}"""

        try:
            response = await self.anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
            result = self._parse_json_safe(text, self._fallback_verdict(feasibility, differentiation))
            return self._validate_verdict(result)
        except Exception:
            return self._fallback_verdict(feasibility, differentiation)

    # ── Validation ────────────────────────────────────────────────

    @staticmethod
    def _clamp(value, min_val=0, max_val=100) -> int:
        """Clamp a score to valid range."""
        try:
            return max(min_val, min(max_val, int(value)))
        except (TypeError, ValueError):
            return 50

    def _validate_feasibility(self, data: dict) -> dict:
        """Validate and sanitize feasibility analysis result."""
        data["score"] = self._clamp(data.get("score", 50))

        valid_feasibility = {"possible", "partial", "difficult"}
        if data.get("overall_feasibility") not in valid_feasibility:
            score = data["score"]
            data["overall_feasibility"] = "possible" if score >= 70 else "partial" if score >= 40 else "difficult"

        data.setdefault("tech_requirements", [])
        data.setdefault("key_risks", [])
        data.setdefault("implementation_steps", [])
        data.setdefault("required_apis", [])
        data.setdefault("complexity_breakdown", {})
        data.setdefault("time_estimate", "알 수 없음")
        data.setdefault("time_feasible", data["score"] >= 50)
        data.setdefault("skill_level", "mid")
        data.setdefault("summary", "")

        valid_diff = {"easy", "medium", "hard"}
        for req in data["tech_requirements"]:
            if req.get("difficulty") not in valid_diff:
                req["difficulty"] = "medium"

        valid_complexity = {"low", "medium", "high"}
        for step in data["implementation_steps"]:
            if step.get("complexity") not in valid_complexity:
                step["complexity"] = "medium"

        return data

    def _validate_differentiation(self, data: dict) -> dict:
        """Validate and sanitize differentiation analysis result."""
        data["competition_score"] = self._clamp(data.get("competition_score", 50))

        valid_levels = {"blue_ocean", "moderate", "red_ocean"}
        if data.get("competition_level") not in valid_levels:
            score = data["competition_score"]
            data["competition_level"] = "blue_ocean" if score >= 70 else "moderate" if score >= 40 else "red_ocean"

        data.setdefault("existing_solutions", [])
        data.setdefault("unique_angles", [])
        data.setdefault("devil_arguments", [])
        data.setdefault("market_gap", "")
        data.setdefault("pivot_suggestions", [])
        data.setdefault("summary", "")

        for sol in data["existing_solutions"]:
            sol["similarity"] = self._clamp(sol.get("similarity", 50))

        return data

    def _validate_verdict(self, data: dict) -> dict:
        """Validate verdict with weighted scoring and category minimum enforcement."""
        scores = data.get("scores", {})
        for key in ["competition", "feasibility", "differentiation", "timing"]:
            scores[key] = self._clamp(scores.get(key, 50))
        data["scores"] = scores

        # Recalculate overall_score using weights
        weighted = sum(scores[k] * SCORE_WEIGHTS[k] for k in SCORE_WEIGHTS)
        data["overall_score"] = self._clamp(round(weighted))

        data["confidence"] = self._clamp(data.get("confidence", 50))

        # Enforce verdict rules
        min_score = min(scores.values())
        overall = data["overall_score"]

        valid_verdicts = {"GO", "PIVOT", "KILL"}
        if data.get("verdict") not in valid_verdicts:
            data["verdict"] = self._compute_verdict(overall, min_score)
        else:
            # Override LLM verdict if hard rules are violated
            if data["verdict"] == "GO" and (overall < 70 or min_score < CATEGORY_MINIMUM_FOR_GO):
                data["verdict"] = "PIVOT"
            if data["verdict"] != "KILL" and overall < 40:
                data["verdict"] = "KILL"

        data.setdefault("one_liner", "")
        data.setdefault("recommendation", "")
        data.setdefault("strengths", [])
        data.setdefault("weaknesses", [])
        data.setdefault("alternative_ideas", [])

        return data

    @staticmethod
    def _compute_verdict(overall_score: int, min_category_score: int) -> str:
        """Determine verdict from scores."""
        if overall_score >= 70 and min_category_score >= CATEGORY_MINIMUM_FOR_GO:
            return "GO"
        elif overall_score >= 40:
            return "PIVOT"
        else:
            return "KILL"

    # ── JSON Parsing ──────────────────────────────────────────────

    def _parse_json_safe(self, text: str, fallback: dict) -> dict:
        """Safely parse JSON from LLM response."""
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

    # ── Fallbacks (Enhanced) ──────────────────────────────────────

    def _fallback_feasibility(self, idea: str, mode: str = "hackathon", github_results: dict | None = None) -> dict:
        """Context-aware fallback using GitHub data signals."""
        base_score = 50

        if github_results:
            repo_count = github_results.get("total_count", 0)
            repos = github_results.get("repos", [])

            # Many similar projects = proven concept = higher feasibility
            if repo_count > 50:
                base_score = 65
            elif repo_count > 10:
                base_score = 60
            elif repo_count > 0:
                base_score = 55

            # Active repos = validated tech stack
            active_repos = sum(1 for r in repos if r.get("recent_commits", 0) > 0)
            if active_repos > 2:
                base_score = min(base_score + 5, 75)

        # Hackathon time pressure
        if mode == "hackathon":
            base_score = max(base_score - 10, 20)

        feasibility = "possible" if base_score >= 65 else "partial" if base_score >= 40 else "difficult"

        return {
            "overall_feasibility": feasibility,
            "score": base_score,
            "tech_requirements": [],
            "implementation_steps": [],
            "required_apis": [],
            "complexity_breakdown": {},
            "key_risks": ["LLM 분석 실패 — fallback 데이터입니다"],
            "time_estimate": MODE_TIME_CONSTRAINTS.get(mode, "알 수 없음"),
            "time_feasible": base_score >= 50,
            "skill_level": "mid",
            "summary": "AI 분석을 수행하지 못했습니다. API 키를 확인하세요.",
        }

    def _fallback_differentiation(self, idea: str, competitors: dict, github_results: dict) -> dict:
        """Non-linear scoring fallback using competitor + GitHub activity signals."""
        web_count = competitors.get("raw_count", 0)
        github_count = github_results.get("total_count", 0)

        # Non-linear penalty: first few competitors hurt more
        if web_count <= 5:
            penalty = web_count * 8
        elif web_count <= 15:
            penalty = 40 + (web_count - 5) * 4
        else:
            penalty = 80 + (web_count - 15) * 2

        # GitHub penalty (weighted less — OSS != commercial competitor)
        github_penalty = min(github_count * 2, 30)

        score = max(0, min(100, 100 - penalty - github_penalty))

        # Active repos are a stronger signal of competition
        active_repos = sum(1 for r in github_results.get("repos", []) if r.get("recent_commits", 0) > 0)
        if active_repos > 3:
            score = max(0, score - 10)

        level = "red_ocean" if score < 30 else "moderate" if score < 65 else "blue_ocean"

        return {
            "competition_level": level,
            "competition_score": score,
            "existing_solutions": [],
            "unique_angles": [],
            "devil_arguments": ["AI 분석 없이는 구체적 약점을 파악할 수 없습니다"],
            "market_gap": "",
            "pivot_suggestions": [],
            "summary": f"웹 경쟁 {web_count}개 + GitHub {github_count}개 기반 자동 판정 (활성 레포 {active_repos}개)",
        }

    def _fallback_verdict(self, feasibility: dict, differentiation: dict) -> dict:
        """Weighted fallback verdict using all available signals."""
        f_score = self._clamp(feasibility.get("score", 50))
        d_score = self._clamp(differentiation.get("competition_score", 50))

        scores = {
            "competition": d_score,
            "feasibility": f_score,
            "differentiation": d_score,
            "timing": 50,
        }

        weighted = sum(scores[k] * SCORE_WEIGHTS[k] for k in SCORE_WEIGHTS)
        overall = self._clamp(round(weighted))
        min_score = min(scores.values())
        verdict = self._compute_verdict(overall, min_score)

        return {
            "verdict": verdict,
            "confidence": 30,
            "overall_score": overall,
            "scores": scores,
            "one_liner": "AI 분석 없이 점수 기반 자동 판정입니다.",
            "recommendation": "API 키를 설정하면 더 정확한 분석을 받을 수 있습니다.",
            "strengths": [],
            "weaknesses": [],
            "alternative_ideas": [],
        }
