"""Integration tests — full pipeline with mocked external services."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from analyzer import IdeaAnalyzer
from tests.conftest import (
    SAMPLE_IDEA, SAMPLE_MODE, SAMPLE_COMPETITORS, SAMPLE_GITHUB,
    SAMPLE_FEASIBILITY, SAMPLE_DIFFERENTIATION, SAMPLE_VERDICT,
)


def _make_mock_claude_response(json_data: dict):
    """Create a mock Claude API response object."""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=json.dumps(json_data, ensure_ascii=False))]
    return mock_response


def _make_mock_tavily_response(results: list[dict]):
    """Create a mock Tavily HTTP response."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"results": results}
    return mock_resp


def _make_mock_github_response(items: list[dict], total_count: int = 1):
    """Create a mock GitHub HTTP response."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"items": items, "total_count": total_count}
    return mock_resp


class TestFullPipelineWithMocks:
    """Test the full 5-step pipeline with all external services mocked."""

    @pytest.mark.asyncio
    async def test_pipeline_produces_all_events(self):
        """The pipeline should yield step_start, step_result for all 5 steps, plus done."""
        analyzer = IdeaAnalyzer(
            anthropic_api_key="fake-key",
            tavily_api_key="fake-key",
            github_token="fake-token",
        )

        # Mock _generate_search_queries
        analyzer._generate_search_queries = AsyncMock(return_value={
            "web_queries": ["test query 1", "test query 2"],
            "github_query": "test github query",
        })
        # Mock _search_web
        analyzer._search_web = AsyncMock(return_value=SAMPLE_COMPETITORS)
        # Mock _search_github
        analyzer._search_github = AsyncMock(return_value=SAMPLE_GITHUB)

        # Mock streaming methods to yield result directly
        async def mock_stream_feasibility(*args, **kwargs):
            yield {"type": "result", "result": SAMPLE_FEASIBILITY}

        async def mock_stream_differentiation(*args, **kwargs):
            yield {"type": "result", "result": SAMPLE_DIFFERENTIATION}

        async def mock_stream_verdict(*args, **kwargs):
            yield {"type": "result", "result": SAMPLE_VERDICT}

        analyzer._stream_feasibility = mock_stream_feasibility
        analyzer._stream_differentiation = mock_stream_differentiation
        analyzer._stream_verdict = mock_stream_verdict

        events = []
        async for event in analyzer.analyze(SAMPLE_IDEA, SAMPLE_MODE):
            events.append(event)

        # Verify event types
        event_types = [e["event"] for e in events]

        # Should have step_start and step_result for each of 5 steps
        assert event_types.count("step_start") == 5
        assert event_types.count("step_result") == 5
        assert event_types[-1] == "done"

        # Verify step numbers are sequential
        step_starts = [e["data"]["step"] for e in events if e["event"] == "step_start"]
        assert step_starts == [1, 2, 3, 4, 5]

        step_results = [e["data"]["step"] for e in events if e["event"] == "step_result"]
        assert step_results == [1, 2, 3, 4, 5]

    @pytest.mark.asyncio
    async def test_pipeline_step_results_have_data(self):
        """Each step_result should contain a non-None result."""
        analyzer = IdeaAnalyzer(anthropic_api_key="fake", tavily_api_key="fake")

        analyzer._generate_search_queries = AsyncMock(return_value={
            "web_queries": ["q1", "q2"], "github_query": "q"
        })
        analyzer._search_web = AsyncMock(return_value=SAMPLE_COMPETITORS)
        analyzer._search_github = AsyncMock(return_value=SAMPLE_GITHUB)

        async def mock_feasibility(*a, **kw):
            yield {"type": "result", "result": SAMPLE_FEASIBILITY}
        async def mock_diff(*a, **kw):
            yield {"type": "result", "result": SAMPLE_DIFFERENTIATION}
        async def mock_verdict(*a, **kw):
            yield {"type": "result", "result": SAMPLE_VERDICT}

        analyzer._stream_feasibility = mock_feasibility
        analyzer._stream_differentiation = mock_diff
        analyzer._stream_verdict = mock_verdict

        results = {}
        async for event in analyzer.analyze(SAMPLE_IDEA, SAMPLE_MODE):
            if event["event"] == "step_result":
                results[event["data"]["step"]] = event["data"]["result"]

        assert len(results) == 5
        for step_num in range(1, 6):
            assert results[step_num] is not None

    @pytest.mark.asyncio
    async def test_done_event_message(self):
        """The final done event should contain the '분석 완료' message."""
        analyzer = IdeaAnalyzer(anthropic_api_key="fake", tavily_api_key="fake")

        analyzer._generate_search_queries = AsyncMock(return_value={
            "web_queries": ["q1", "q2"], "github_query": "q"
        })
        analyzer._search_web = AsyncMock(return_value=SAMPLE_COMPETITORS)
        analyzer._search_github = AsyncMock(return_value=SAMPLE_GITHUB)

        async def mock_feasibility(*a, **kw):
            yield {"type": "result", "result": SAMPLE_FEASIBILITY}
        async def mock_diff(*a, **kw):
            yield {"type": "result", "result": SAMPLE_DIFFERENTIATION}
        async def mock_verdict(*a, **kw):
            yield {"type": "result", "result": SAMPLE_VERDICT}

        analyzer._stream_feasibility = mock_feasibility
        analyzer._stream_differentiation = mock_diff
        analyzer._stream_verdict = mock_verdict

        events = []
        async for event in analyzer.analyze(SAMPLE_IDEA, SAMPLE_MODE):
            events.append(event)

        done_event = events[-1]
        assert done_event["event"] == "done"
        assert done_event["data"]["message"] == "분석 완료"


class TestFallbackPaths:
    """Test that fallback paths work when API keys are missing."""

    @pytest.mark.asyncio
    async def test_no_api_keys_uses_all_fallbacks(self):
        """With no API keys, pipeline should still complete using fallbacks."""
        analyzer = IdeaAnalyzer(anthropic_api_key="", tavily_api_key="", github_token="")

        events = []
        async for event in analyzer.analyze(SAMPLE_IDEA, SAMPLE_MODE):
            events.append(event)

        event_types = [e["event"] for e in events]
        assert event_types.count("step_start") == 5
        assert event_types.count("step_result") == 5
        assert "done" in event_types

    @pytest.mark.asyncio
    async def test_no_tavily_key_returns_empty_competitors(self):
        """Without Tavily key, step 1 should return empty competitors."""
        analyzer = IdeaAnalyzer(anthropic_api_key="", tavily_api_key="", github_token="")

        results = {}
        async for event in analyzer.analyze(SAMPLE_IDEA, SAMPLE_MODE):
            if event["event"] == "step_result":
                results[event["data"]["step"]] = event["data"]["result"]

        step1 = results[1]
        assert step1["competitors"] == []
        assert step1["raw_count"] == 0

    @pytest.mark.asyncio
    async def test_no_anthropic_key_returns_fallback_feasibility(self):
        """Without Claude key, step 3 should return fallback feasibility."""
        analyzer = IdeaAnalyzer(anthropic_api_key="", tavily_api_key="", github_token="")

        results = {}
        async for event in analyzer.analyze(SAMPLE_IDEA, SAMPLE_MODE):
            if event["event"] == "step_result":
                results[event["data"]["step"]] = event["data"]["result"]

        step3 = results[3]
        assert step3["overall_feasibility"] == "partial"
        assert step3["score"] == 50

    @pytest.mark.asyncio
    async def test_no_anthropic_key_returns_fallback_verdict(self):
        """Without Claude key, step 5 should return fallback verdict."""
        analyzer = IdeaAnalyzer(anthropic_api_key="", tavily_api_key="", github_token="")

        results = {}
        async for event in analyzer.analyze(SAMPLE_IDEA, SAMPLE_MODE):
            if event["event"] == "step_result":
                results[event["data"]["step"]] = event["data"]["result"]

        step5 = results[5]
        assert step5["verdict"] in ("GO", "PIVOT", "KILL")
        assert step5["confidence"] == 40  # fallback confidence


class TestStreamProgress:
    """Test that progress events are emitted during streaming."""

    @pytest.mark.asyncio
    async def test_progress_events_forwarded(self):
        """Progress events from streaming should be forwarded as step_progress."""
        analyzer = IdeaAnalyzer(anthropic_api_key="fake", tavily_api_key="fake")

        analyzer._generate_search_queries = AsyncMock(return_value={
            "web_queries": ["q1", "q2"], "github_query": "q"
        })
        analyzer._search_web = AsyncMock(return_value=SAMPLE_COMPETITORS)
        analyzer._search_github = AsyncMock(return_value=SAMPLE_GITHUB)

        async def mock_feasibility_with_progress(*a, **kw):
            yield {"type": "progress", "text": "AI 응답 생성 중... (80자)"}
            yield {"type": "progress", "text": "AI 응답 생성 중... (160자)"}
            yield {"type": "result", "result": SAMPLE_FEASIBILITY}

        async def mock_diff(*a, **kw):
            yield {"type": "result", "result": SAMPLE_DIFFERENTIATION}
        async def mock_verdict(*a, **kw):
            yield {"type": "result", "result": SAMPLE_VERDICT}

        analyzer._stream_feasibility = mock_feasibility_with_progress
        analyzer._stream_differentiation = mock_diff
        analyzer._stream_verdict = mock_verdict

        events = []
        async for event in analyzer.analyze(SAMPLE_IDEA, SAMPLE_MODE):
            events.append(event)

        progress_events = [e for e in events if e["event"] == "step_progress"]
        assert len(progress_events) >= 2
        assert progress_events[0]["data"]["step"] == 3
