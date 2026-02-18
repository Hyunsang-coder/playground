"""Live API consistency tests — verify structural consistency across runs.

Run with: pytest -v -m live_api
Skipped by default unless API keys are set in environment.
"""

import os
import pytest

from analyzer import IdeaAnalyzer


pytestmark = pytest.mark.live_api

ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")
TAVILY_KEY = os.getenv("TAVILY_API_KEY", "")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

skip_if_no_keys = pytest.mark.skipif(
    not ANTHROPIC_KEY or not TAVILY_KEY,
    reason="ANTHROPIC_API_KEY and TAVILY_API_KEY required for live tests",
)

CONSISTENCY_IDEA = "AI 기반 코드 리뷰 자동화 도구"
CONSISTENCY_MODE = "hackathon"


async def _run_pipeline(idea: str, mode: str) -> dict:
    """Run the analysis pipeline and return results by step number."""
    analyzer = IdeaAnalyzer(
        anthropic_api_key=ANTHROPIC_KEY,
        tavily_api_key=TAVILY_KEY,
        github_token=GITHUB_TOKEN,
    )
    results = {}
    async for event in analyzer.analyze(idea, mode):
        if event["event"] == "step_result":
            results[event["data"]["step"]] = event["data"]["result"]
    return results


@skip_if_no_keys
class TestLiveConsistency:
    """Run the same idea twice and verify structural consistency."""

    @pytest.mark.asyncio
    async def test_structural_consistency_across_runs(self):
        """Two runs of the same idea should produce structurally consistent results."""
        run1 = await _run_pipeline(CONSISTENCY_IDEA, CONSISTENCY_MODE)
        run2 = await _run_pipeline(CONSISTENCY_IDEA, CONSISTENCY_MODE)

        # Both runs should have all 5 steps
        assert set(run1.keys()) == {1, 2, 3, 4, 5}
        assert set(run2.keys()) == {1, 2, 3, 4, 5}

        # Step 1: Web search — both should have same keys
        assert set(run1[1].keys()) == set(run2[1].keys())

        # Step 2: GitHub — both should have same keys
        assert set(run1[2].keys()) == set(run2[2].keys())

        # Step 3: Feasibility — both should have same top-level keys
        assert set(run1[3].keys()) == set(run2[3].keys())

        # Step 4: Differentiation — both should have same top-level keys
        assert set(run1[4].keys()) == set(run2[4].keys())

        # Step 5: Verdict — both should have same top-level keys
        assert set(run1[5].keys()) == set(run2[5].keys())

    @pytest.mark.asyncio
    async def test_verdict_values_within_valid_ranges(self):
        """Both runs should produce verdicts within valid ranges."""
        run1 = await _run_pipeline(CONSISTENCY_IDEA, CONSISTENCY_MODE)
        run2 = await _run_pipeline(CONSISTENCY_IDEA, CONSISTENCY_MODE)

        for run in [run1, run2]:
            verdict = run[5]
            assert verdict["verdict"] in ("GO", "PIVOT", "KILL")
            assert 0 <= verdict["overall_score"] <= 100
            assert 0 <= verdict["confidence"] <= 100
            for key in ("competition", "feasibility", "differentiation", "timing"):
                assert 0 <= verdict["scores"][key] <= 100

    @pytest.mark.asyncio
    async def test_feasibility_values_consistent_type(self):
        """Both runs should produce feasibility with valid enum values."""
        run1 = await _run_pipeline(CONSISTENCY_IDEA, CONSISTENCY_MODE)
        run2 = await _run_pipeline(CONSISTENCY_IDEA, CONSISTENCY_MODE)

        for run in [run1, run2]:
            feas = run[3]
            assert feas["overall_feasibility"] in ("possible", "partial", "difficult")
            assert 0 <= feas["score"] <= 100
            assert isinstance(feas["tech_requirements"], list)
            assert isinstance(feas["key_risks"], list)

    @pytest.mark.asyncio
    async def test_differentiation_values_consistent_type(self):
        """Both runs should produce differentiation with valid enum values."""
        run1 = await _run_pipeline(CONSISTENCY_IDEA, CONSISTENCY_MODE)
        run2 = await _run_pipeline(CONSISTENCY_IDEA, CONSISTENCY_MODE)

        for run in [run1, run2]:
            diff = run[4]
            assert diff["competition_level"] in ("blue_ocean", "moderate", "red_ocean")
            assert 0 <= diff["competition_score"] <= 100
            assert isinstance(diff["existing_solutions"], list)
            assert isinstance(diff["devil_arguments"], list)
