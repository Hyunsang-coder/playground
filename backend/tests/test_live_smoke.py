"""Live API smoke tests — require real API keys.

Run with: pytest -v -m live_api
Skipped by default unless API keys are set in environment.
"""

import os
import pytest

from analyzer import IdeaAnalyzer
from tests.test_schema import (
    validate_web_search_result,
    validate_github_search_result,
    validate_feasibility_result,
    validate_differentiation_result,
    validate_verdict_result,
)


# Skip all tests in this module if API keys are not configured
pytestmark = pytest.mark.live_api

ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")
TAVILY_KEY = os.getenv("TAVILY_API_KEY", "")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

skip_if_no_keys = pytest.mark.skipif(
    not ANTHROPIC_KEY or not TAVILY_KEY,
    reason="ANTHROPIC_API_KEY and TAVILY_API_KEY required for live tests",
)


SAMPLE_IDEAS = [
    ("AI 기반 코드 리뷰 자동화 도구", "hackathon"),
    ("실시간 환율 비교 알림 앱", "startup"),
    ("개발자 포트폴리오 자동 생성 CLI", "sideproject"),
]


@skip_if_no_keys
class TestLiveSmoke:
    """Run sample ideas through the full pipeline with real APIs."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("idea,mode", SAMPLE_IDEAS)
    async def test_full_pipeline_structure(self, idea: str, mode: str):
        """Each sample idea should complete all 5 steps with valid structure."""
        analyzer = IdeaAnalyzer(
            anthropic_api_key=ANTHROPIC_KEY,
            tavily_api_key=TAVILY_KEY,
            github_token=GITHUB_TOKEN,
        )

        results = {}
        event_types = []

        async for event in analyzer.analyze(idea, mode):
            event_types.append(event["event"])
            if event["event"] == "step_result":
                results[event["data"]["step"]] = event["data"]["result"]

        # All 5 steps should have results
        assert len(results) == 5, f"Expected 5 step results, got {len(results)}"

        # Pipeline should end with done
        assert event_types[-1] == "done"

    @pytest.mark.asyncio
    @pytest.mark.parametrize("idea,mode", SAMPLE_IDEAS)
    async def test_step1_web_search_schema(self, idea: str, mode: str):
        """Step 1 result should match WebSearchResult schema."""
        analyzer = IdeaAnalyzer(
            anthropic_api_key=ANTHROPIC_KEY,
            tavily_api_key=TAVILY_KEY,
            github_token=GITHUB_TOKEN,
        )

        async for event in analyzer.analyze(idea, mode):
            if event["event"] == "step_result" and event["data"]["step"] == 1:
                validate_web_search_result(event["data"]["result"])
                return

    @pytest.mark.asyncio
    @pytest.mark.parametrize("idea,mode", SAMPLE_IDEAS)
    async def test_step2_github_search_schema(self, idea: str, mode: str):
        """Step 2 result should match GitHubSearchResult schema."""
        analyzer = IdeaAnalyzer(
            anthropic_api_key=ANTHROPIC_KEY,
            tavily_api_key=TAVILY_KEY,
            github_token=GITHUB_TOKEN,
        )

        async for event in analyzer.analyze(idea, mode):
            if event["event"] == "step_result" and event["data"]["step"] == 2:
                validate_github_search_result(event["data"]["result"])
                return

    @pytest.mark.asyncio
    @pytest.mark.parametrize("idea,mode", SAMPLE_IDEAS)
    async def test_step3_feasibility_schema(self, idea: str, mode: str):
        """Step 3 result should match FeasibilityResult schema."""
        analyzer = IdeaAnalyzer(
            anthropic_api_key=ANTHROPIC_KEY,
            tavily_api_key=TAVILY_KEY,
            github_token=GITHUB_TOKEN,
        )

        async for event in analyzer.analyze(idea, mode):
            if event["event"] == "step_result" and event["data"]["step"] == 3:
                validate_feasibility_result(event["data"]["result"])
                return

    @pytest.mark.asyncio
    @pytest.mark.parametrize("idea,mode", SAMPLE_IDEAS)
    async def test_step4_differentiation_schema(self, idea: str, mode: str):
        """Step 4 result should match DifferentiationResult schema."""
        analyzer = IdeaAnalyzer(
            anthropic_api_key=ANTHROPIC_KEY,
            tavily_api_key=TAVILY_KEY,
            github_token=GITHUB_TOKEN,
        )

        async for event in analyzer.analyze(idea, mode):
            if event["event"] == "step_result" and event["data"]["step"] == 4:
                validate_differentiation_result(event["data"]["result"])
                return

    @pytest.mark.asyncio
    @pytest.mark.parametrize("idea,mode", SAMPLE_IDEAS)
    async def test_step5_verdict_schema(self, idea: str, mode: str):
        """Step 5 result should match VerdictResult schema."""
        analyzer = IdeaAnalyzer(
            anthropic_api_key=ANTHROPIC_KEY,
            tavily_api_key=TAVILY_KEY,
            github_token=GITHUB_TOKEN,
        )

        async for event in analyzer.analyze(idea, mode):
            if event["event"] == "step_result" and event["data"]["step"] == 5:
                validate_verdict_result(event["data"]["result"])
                return

    @pytest.mark.asyncio
    @pytest.mark.parametrize("idea,mode", SAMPLE_IDEAS)
    async def test_verdict_value_ranges(self, idea: str, mode: str):
        """All scores should be within 0-100 and verdict should be valid."""
        analyzer = IdeaAnalyzer(
            anthropic_api_key=ANTHROPIC_KEY,
            tavily_api_key=TAVILY_KEY,
            github_token=GITHUB_TOKEN,
        )

        async for event in analyzer.analyze(idea, mode):
            if event["event"] == "step_result" and event["data"]["step"] == 5:
                verdict = event["data"]["result"]
                assert verdict["verdict"] in ("GO", "PIVOT", "KILL")
                assert 0 <= verdict["overall_score"] <= 100
                assert 0 <= verdict["confidence"] <= 100
                for key in ("competition", "feasibility", "differentiation", "timing"):
                    assert 0 <= verdict["scores"][key] <= 100
                return
