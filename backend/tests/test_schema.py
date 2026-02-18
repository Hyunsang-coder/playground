"""Schema validation tests — ensures results match TypeScript type definitions."""

import pytest
from analyzer import IdeaAnalyzer
from tests.conftest import (
    SAMPLE_IDEA, SAMPLE_MODE, SAMPLE_COMPETITORS, SAMPLE_GITHUB,
    SAMPLE_FEASIBILITY, SAMPLE_DIFFERENTIATION, SAMPLE_VERDICT,
)


# ===== Schema validator helpers =====

def validate_web_search_result(data: dict):
    """Validate against WebSearchResult TypeScript interface."""
    assert "competitors" in data, "Missing 'competitors'"
    assert "raw_count" in data, "Missing 'raw_count'"
    assert "summary" in data, "Missing 'summary'"
    assert isinstance(data["competitors"], list)
    assert isinstance(data["raw_count"], int)
    assert data["raw_count"] >= 0
    assert isinstance(data["summary"], str)
    for comp in data["competitors"]:
        assert "title" in comp
        assert "url" in comp
        assert "snippet" in comp


def validate_github_search_result(data: dict):
    """Validate against GitHubSearchResult TypeScript interface."""
    assert "repos" in data, "Missing 'repos'"
    assert "total_count" in data, "Missing 'total_count'"
    assert "summary" in data, "Missing 'summary'"
    assert isinstance(data["repos"], list)
    assert isinstance(data["total_count"], int)
    assert data["total_count"] >= 0
    for repo in data["repos"]:
        assert "name" in repo
        assert "description" in repo
        assert "stars" in repo
        assert "url" in repo
        assert "language" in repo
        assert "updated" in repo
        assert isinstance(repo["stars"], int)


def validate_feasibility_result(data: dict):
    """Validate against FeasibilityResult TypeScript interface."""
    assert "overall_feasibility" in data
    assert data["overall_feasibility"] in ("possible", "partial", "difficult")
    assert "score" in data
    assert isinstance(data["score"], (int, float))
    assert 0 <= data["score"] <= 100
    assert "tech_requirements" in data
    assert isinstance(data["tech_requirements"], list)
    for req in data["tech_requirements"]:
        assert "name" in req
        assert "available" in req
        assert "difficulty" in req
        assert req["difficulty"] in ("easy", "medium", "hard")
        assert "note" in req
    assert "key_risks" in data
    assert isinstance(data["key_risks"], list)
    assert "time_estimate" in data
    assert "summary" in data


def validate_differentiation_result(data: dict):
    """Validate against DifferentiationResult TypeScript interface."""
    assert "competition_level" in data
    assert data["competition_level"] in ("blue_ocean", "moderate", "red_ocean")
    assert "competition_score" in data
    assert isinstance(data["competition_score"], (int, float))
    assert 0 <= data["competition_score"] <= 100
    assert "existing_solutions" in data
    assert isinstance(data["existing_solutions"], list)
    for sol in data["existing_solutions"]:
        assert "name" in sol
        assert "similarity" in sol
        assert "weakness" in sol
    assert "unique_angles" in data
    assert isinstance(data["unique_angles"], list)
    assert "devil_arguments" in data
    assert isinstance(data["devil_arguments"], list)
    assert "pivot_suggestions" in data
    assert isinstance(data["pivot_suggestions"], list)
    assert "summary" in data


def validate_verdict_result(data: dict):
    """Validate against VerdictResult TypeScript interface."""
    assert "verdict" in data
    assert data["verdict"] in ("GO", "PIVOT", "KILL")
    assert "confidence" in data
    assert isinstance(data["confidence"], (int, float))
    assert 0 <= data["confidence"] <= 100
    assert "overall_score" in data
    assert isinstance(data["overall_score"], (int, float))
    assert 0 <= data["overall_score"] <= 100
    assert "scores" in data
    scores = data["scores"]
    for key in ("competition", "feasibility", "differentiation", "timing"):
        assert key in scores, f"Missing score key: {key}"
        assert isinstance(scores[key], (int, float))
        assert 0 <= scores[key] <= 100
    assert "one_liner" in data
    assert isinstance(data["one_liner"], str)
    assert "recommendation" in data
    assert isinstance(data["recommendation"], str)
    assert "alternative_ideas" in data
    assert isinstance(data["alternative_ideas"], list)


# ===== Tests =====

class TestSampleDataSchemaValidity:
    """Verify that our test fixtures themselves pass schema validation."""

    def test_sample_competitors_schema(self):
        validate_web_search_result(SAMPLE_COMPETITORS)

    def test_sample_github_schema(self):
        validate_github_search_result(SAMPLE_GITHUB)

    def test_sample_feasibility_schema(self):
        validate_feasibility_result(SAMPLE_FEASIBILITY)

    def test_sample_differentiation_schema(self):
        validate_differentiation_result(SAMPLE_DIFFERENTIATION)

    def test_sample_verdict_schema(self):
        validate_verdict_result(SAMPLE_VERDICT)


class TestFallbackSchemaValidity:
    """Verify fallback results conform to the expected schemas."""

    def setup_method(self):
        self.analyzer = IdeaAnalyzer(anthropic_api_key="", tavily_api_key="")

    def test_fallback_feasibility_schema(self):
        result = self.analyzer._fallback_feasibility("test idea")
        validate_feasibility_result(result)

    def test_fallback_differentiation_schema_blue_ocean(self):
        result = self.analyzer._fallback_differentiation(
            "test", {"raw_count": 0}, {"total_count": 0}
        )
        validate_differentiation_result(result)

    def test_fallback_differentiation_schema_red_ocean(self):
        result = self.analyzer._fallback_differentiation(
            "test", {"raw_count": 15}, {"total_count": 10}
        )
        validate_differentiation_result(result)

    def test_fallback_verdict_schema_go(self):
        result = self.analyzer._fallback_verdict(
            {"score": 80}, {"competition_score": 80}
        )
        validate_verdict_result(result)

    def test_fallback_verdict_schema_kill(self):
        result = self.analyzer._fallback_verdict(
            {"score": 20}, {"competition_score": 20}
        )
        validate_verdict_result(result)


class TestFullPipelineFallbackSchemas:
    """Run the pipeline with no API keys and validate all results against schemas."""

    @pytest.mark.asyncio
    async def test_all_fallback_results_valid(self):
        analyzer = IdeaAnalyzer(anthropic_api_key="", tavily_api_key="", github_token="")

        results = {}
        async for event in analyzer.analyze(SAMPLE_IDEA, SAMPLE_MODE):
            if event["event"] == "step_result":
                results[event["data"]["step"]] = event["data"]["result"]

        validate_web_search_result(results[1])
        validate_github_search_result(results[2])
        validate_feasibility_result(results[3])
        validate_differentiation_result(results[4])
        validate_verdict_result(results[5])


class TestSSEEventSchema:
    """Validate that SSE events have the correct structure."""

    @pytest.mark.asyncio
    async def test_step_start_events_structure(self):
        analyzer = IdeaAnalyzer(anthropic_api_key="", tavily_api_key="", github_token="")

        async for event in analyzer.analyze(SAMPLE_IDEA, SAMPLE_MODE):
            if event["event"] == "step_start":
                data = event["data"]
                assert "step" in data
                assert isinstance(data["step"], int)
                assert 1 <= data["step"] <= 5
                assert "title" in data
                assert isinstance(data["title"], str)
                assert "description" in data
                assert isinstance(data["description"], str)

    @pytest.mark.asyncio
    async def test_step_result_events_structure(self):
        analyzer = IdeaAnalyzer(anthropic_api_key="", tavily_api_key="", github_token="")

        async for event in analyzer.analyze(SAMPLE_IDEA, SAMPLE_MODE):
            if event["event"] == "step_result":
                data = event["data"]
                assert "step" in data
                assert isinstance(data["step"], int)
                assert 1 <= data["step"] <= 5
                assert "result" in data
                assert data["result"] is not None

    @pytest.mark.asyncio
    async def test_done_event_structure(self):
        analyzer = IdeaAnalyzer(anthropic_api_key="", tavily_api_key="", github_token="")

        events = []
        async for event in analyzer.analyze(SAMPLE_IDEA, SAMPLE_MODE):
            events.append(event)

        done_events = [e for e in events if e["event"] == "done"]
        assert len(done_events) == 1
        assert done_events[0]["data"]["message"] == "분석 완료"
