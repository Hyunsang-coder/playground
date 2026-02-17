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

        # Step 1: Web search for competitors
        yield {"event": "step_start", "data": {"step": 1, "title": "경쟁 제품 탐색", "description": "웹에서 유사 서비스를 검색하고 있습니다..."}}
        await asyncio.sleep(0.3)

        competitors = await self._search_web(idea)
        yield {"event": "step_result", "data": {"step": 1, "result": competitors}}

        # Step 2: GitHub search for similar projects
        yield {"event": "step_start", "data": {"step": 2, "title": "GitHub 유사 프로젝트 탐색", "description": "오픈소스 프로젝트를 검색하고 있습니다..."}}
        await asyncio.sleep(0.3)

        github_results = await self._search_github(idea)
        yield {"event": "step_result", "data": {"step": 2, "result": github_results}}

        # Step 3: Technical feasibility analysis (LLM)
        yield {"event": "step_start", "data": {"step": 3, "title": "기술 실현성 분석", "description": "AI가 기술적 구현 가능성을 분석하고 있습니다..."}}
        await asyncio.sleep(0.3)

        feasibility = await self._analyze_feasibility(idea, mode, competitors, github_results)
        yield {"event": "step_result", "data": {"step": 3, "result": feasibility}}

        # Step 4: Differentiation analysis
        yield {"event": "step_start", "data": {"step": 4, "title": "차별화 분석", "description": "기존 제품 대비 차별점을 분석하고 있습니다..."}}
        await asyncio.sleep(0.3)

        differentiation = await self._analyze_differentiation(idea, competitors, github_results)
        yield {"event": "step_result", "data": {"step": 4, "result": differentiation}}

        # Step 5: Final verdict
        yield {"event": "step_start", "data": {"step": 5, "title": "종합 판정", "description": "최종 리포트를 생성하고 있습니다..."}}
        await asyncio.sleep(0.3)

        verdict = await self._generate_verdict(idea, mode, competitors, github_results, feasibility, differentiation)
        yield {"event": "step_result", "data": {"step": 5, "result": verdict}}

        yield {"event": "done", "data": {"message": "분석 완료"}}

    async def _search_web(self, idea: str) -> dict:
        """Search web for competitors using Tavily API."""
        if not self.tavily_api_key:
            return {"competitors": [], "summary": "검색 API 키가 설정되지 않았습니다.", "raw_count": 0}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # Search for competitors
                resp = await client.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": self.tavily_api_key,
                        "query": f"{idea} tool service app",
                        "max_results": 8,
                        "search_depth": "basic",
                    },
                )
                data = resp.json()

                competitors = []
                for r in data.get("results", []):
                    competitors.append({
                        "title": r.get("title", ""),
                        "url": r.get("url", ""),
                        "snippet": r.get("content", "")[:200],
                    })

                # Second search for direct competitors
                resp2 = await client.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": self.tavily_api_key,
                        "query": f"{idea} alternative competitor similar",
                        "max_results": 5,
                        "search_depth": "basic",
                    },
                )
                data2 = resp2.json()

                for r in data2.get("results", []):
                    url = r.get("url", "")
                    if not any(c["url"] == url for c in competitors):
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

    async def _search_github(self, idea: str) -> dict:
        """Search GitHub for similar projects."""
        try:
            headers = {"Accept": "application/vnd.github.v3+json"}
            if self.github_token:
                headers["Authorization"] = f"token {self.github_token}"

            # Build search query from idea
            query = idea.replace(" ", "+")

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

    async def _analyze_feasibility(self, idea: str, mode: str, competitors: dict, github_results: dict) -> dict:
        """Use Claude to analyze technical feasibility."""
        if not self.anthropic_client:
            return self._fallback_feasibility(idea)

        mode_context = {
            "hackathon": "4시간 해커톤 (1인 개발자)",
            "startup": "초기 스타트업 (3-5명 팀, 3개월)",
            "sideproject": "사이드 프로젝트 (1-2명, 주말 개발)",
        }

        prompt = f"""당신은 기술 실현성을 냉정하게 분석하는 시니어 개발자입니다.

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

        try:
            response = await self.anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
            # Try to parse JSON from response
            return self._parse_json_safe(text, self._fallback_feasibility(idea))
        except Exception as e:
            return self._fallback_feasibility(idea)

    async def _analyze_differentiation(self, idea: str, competitors: dict, github_results: dict) -> dict:
        """Use Claude to analyze differentiation."""
        if not self.anthropic_client:
            return self._fallback_differentiation(idea, competitors, github_results)

        competitor_list = "\n".join(
            [f"- {c['title']}: {c['snippet']}" for c in competitors.get("competitors", [])[:5]]
        ) or "발견된 경쟁 제품 없음"

        github_list = "\n".join(
            [f"- {r['name']} (⭐{r['stars']}): {r['description']}" for r in github_results.get("repos", [])[:5]]
        ) or "발견된 유사 프로젝트 없음"

        prompt = f"""당신은 Devil's Advocate입니다. 아이디어의 차별화 가능성을 냉정하게 분석하세요.

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

        try:
            response = await self.anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
            return self._parse_json_safe(text, self._fallback_differentiation(idea, competitors, github_results))
        except Exception:
            return self._fallback_differentiation(idea, competitors, github_results)

    async def _generate_verdict(self, idea: str, mode: str, competitors: dict, github_results: dict, feasibility: dict, differentiation: dict) -> dict:
        """Generate final verdict using Claude."""
        if not self.anthropic_client:
            return self._fallback_verdict(feasibility, differentiation)

        prompt = f"""당신은 해커톤 아이디어 심판관입니다. 모든 분석 결과를 종합하여 최종 판정을 내리세요.

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

        try:
            response = await self.anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
            return self._parse_json_safe(text, self._fallback_verdict(feasibility, differentiation))
        except Exception:
            return self._fallback_verdict(feasibility, differentiation)

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
