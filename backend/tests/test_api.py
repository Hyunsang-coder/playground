"""API endpoint tests using FastAPI TestClient."""

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient, ASGITransport
from sse_starlette.sse import AppStatus
from main import app
from tests.conftest import (
    SAMPLE_COMPETITORS, SAMPLE_GITHUB,
    SAMPLE_FEASIBILITY, SAMPLE_DIFFERENTIATION, SAMPLE_VERDICT,
)


@pytest.fixture(autouse=True)
def reset_sse_app_status():
    """Reset sse-starlette AppStatus event to avoid cross-test event loop binding."""
    AppStatus.should_exit_event = asyncio.Event()
    yield


@pytest.fixture
def async_client():
    """Create an async test client for the FastAPI app."""
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


class TestHealthEndpoint:

    @pytest.mark.asyncio
    async def test_health_returns_ok(self, async_client):
        resp = await async_client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


class TestAnalyzeEndpointValidation:

    @pytest.mark.asyncio
    async def test_empty_idea_returns_422(self, async_client):
        resp = await async_client.post("/api/analyze", json={"idea": "", "mode": "hackathon"})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_whitespace_idea_returns_422(self, async_client):
        resp = await async_client.post("/api/analyze", json={"idea": "   ", "mode": "hackathon"})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_too_long_idea_returns_422(self, async_client):
        resp = await async_client.post("/api/analyze", json={"idea": "a" * 501, "mode": "hackathon"})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_mode_returns_422(self, async_client):
        resp = await async_client.post("/api/analyze", json={"idea": "valid idea", "mode": "invalid"})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_missing_idea_returns_422(self, async_client):
        resp = await async_client.post("/api/analyze", json={"mode": "hackathon"})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_missing_body_returns_422(self, async_client):
        resp = await async_client.post("/api/analyze")
        assert resp.status_code == 422


class TestAnalyzeEndpointSSE:

    @pytest.mark.asyncio
    async def test_valid_request_returns_sse_stream(self, async_client):
        """A valid request should return a 200 SSE stream with all events."""
        with patch("main.IdeaAnalyzer") as MockAnalyzer:
            mock_instance = MockAnalyzer.return_value

            async def mock_analyze(idea, mode):
                yield {"event": "step_start", "data": {"step": 1, "title": "경쟁 제품 탐색", "description": "검색 중..."}}
                yield {"event": "step_result", "data": {"step": 1, "result": SAMPLE_COMPETITORS}}
                yield {"event": "step_start", "data": {"step": 2, "title": "GitHub 탐색", "description": "검색 중..."}}
                yield {"event": "step_result", "data": {"step": 2, "result": SAMPLE_GITHUB}}
                yield {"event": "step_start", "data": {"step": 3, "title": "실현성 분석", "description": "분석 중..."}}
                yield {"event": "step_result", "data": {"step": 3, "result": SAMPLE_FEASIBILITY}}
                yield {"event": "step_start", "data": {"step": 4, "title": "차별화 분석", "description": "분석 중..."}}
                yield {"event": "step_result", "data": {"step": 4, "result": SAMPLE_DIFFERENTIATION}}
                yield {"event": "step_start", "data": {"step": 5, "title": "종합 판정", "description": "판정 중..."}}
                yield {"event": "step_result", "data": {"step": 5, "result": SAMPLE_VERDICT}}
                yield {"event": "done", "data": {"message": "분석 완료"}}

            mock_instance.analyze = mock_analyze

            resp = await async_client.post(
                "/api/analyze",
                json={"idea": "AI 코드 리뷰 도구", "mode": "hackathon"},
            )
            assert resp.status_code == 200
            assert "text/event-stream" in resp.headers.get("content-type", "")

            body = resp.text
            # SSE body should contain events
            assert "step_start" in body or "step_result" in body or "분석 완료" in body

    @pytest.mark.asyncio
    async def test_default_mode_accepted(self, async_client):
        """Request without mode should default to hackathon and succeed."""
        with patch("main.IdeaAnalyzer") as MockAnalyzer:
            mock_instance = MockAnalyzer.return_value
            received_mode = None

            async def mock_analyze(idea, mode):
                nonlocal received_mode
                received_mode = mode
                yield {"event": "step_start", "data": {"step": 1, "title": "Test", "description": "..."}}
                yield {"event": "step_result", "data": {"step": 1, "result": SAMPLE_COMPETITORS}}
                yield {"event": "done", "data": {"message": "분석 완료"}}

            mock_instance.analyze = mock_analyze

            resp = await async_client.post(
                "/api/analyze",
                json={"idea": "test idea"},
            )
            assert resp.status_code == 200
            assert received_mode == "hackathon"
