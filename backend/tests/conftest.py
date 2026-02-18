"""Shared fixtures for Valid8 backend tests."""

import pytest
from dotenv import load_dotenv
from analyzer import IdeaAnalyzer

load_dotenv()


# ---------------------------------------------------------------------------
# Analyzer fixtures (no real API keys → triggers fallback paths)
# ---------------------------------------------------------------------------

@pytest.fixture
def analyzer():
    """IdeaAnalyzer with no API keys — all external calls will use fallback."""
    return IdeaAnalyzer(anthropic_api_key="", tavily_api_key="", github_token="")


@pytest.fixture
def analyzer_with_keys():
    """IdeaAnalyzer with fake API keys — for mocking tests."""
    return IdeaAnalyzer(
        anthropic_api_key="fake-anthropic-key",
        tavily_api_key="fake-tavily-key",
        github_token="fake-github-token",
    )


# ---------------------------------------------------------------------------
# Sample data
# ---------------------------------------------------------------------------

SAMPLE_IDEA = "AI 기반 코드 리뷰 자동화 도구"
SAMPLE_MODE = "hackathon"

SAMPLE_COMPETITORS = {
    "competitors": [
        {"title": "CodeRabbit", "url": "https://coderabbit.ai", "snippet": "AI code review tool"},
        {"title": "Codacy", "url": "https://codacy.com", "snippet": "Automated code review"},
    ],
    "raw_count": 2,
    "summary": "웹에서 2개의 관련 결과를 발견했습니다.",
}

SAMPLE_GITHUB = {
    "repos": [
        {
            "name": "reviewdog/reviewdog",
            "description": "Automated code review tool",
            "stars": 7000,
            "url": "https://github.com/reviewdog/reviewdog",
            "language": "Go",
            "updated": "2024-01-01",
        }
    ],
    "total_count": 1,
    "summary": "GitHub에서 1개의 관련 저장소를 발견했습니다.",
}

SAMPLE_FEASIBILITY = {
    "overall_feasibility": "possible",
    "score": 75,
    "vibe_coding_difficulty": "medium",
    "bottlenecks": ["코드 컨텍스트 윈도우 제한으로 대규모 파일 분석 어려움", "Git diff 파싱 정확도"],
    "tech_requirements": [
        {"name": "Claude API", "available": True, "difficulty": "easy", "note": "API 키만 있으면 됨"}
    ],
    "key_risks": ["API 비용", "응답 지연"],
    "time_estimate": "4시간",
    "summary": "구현 가능합니다.",
}

SAMPLE_DIFFERENTIATION = {
    "competition_level": "moderate",
    "competition_score": 60,
    "existing_solutions": [
        {"name": "CodeRabbit", "similarity": 70, "weakness": "커스터마이징 부족"}
    ],
    "unique_angles": ["해커톤 특화 분석"],
    "devil_arguments": ["이미 있는데: CodeRabbit이 있다", "이게 되겠어: 4시간 안에?", "누가 써: 기존 도구 충분"],
    "pivot_suggestions": ["특정 언어 특화 리뷰어"],
    "summary": "경쟁이 있지만 틈새가 있습니다.",
}

SAMPLE_VERDICT = {
    "verdict": "PIVOT",
    "confidence": 65,
    "overall_score": 62,
    "scores": {"competition": 55, "feasibility": 75, "differentiation": 60, "timing": 58},
    "one_liner": "방향 수정 후 진행 추천",
    "recommendation": "특정 언어에 특화하세요.",
    "alternative_ideas": ["PR 요약 봇", "코드 보안 스캐너", "테스트 커버리지 분석기"],
}


@pytest.fixture
def sample_idea():
    return SAMPLE_IDEA


@pytest.fixture
def sample_mode():
    return SAMPLE_MODE


@pytest.fixture
def sample_competitors():
    return SAMPLE_COMPETITORS.copy()


@pytest.fixture
def sample_github():
    return SAMPLE_GITHUB.copy()


@pytest.fixture
def sample_feasibility():
    return SAMPLE_FEASIBILITY.copy()


@pytest.fixture
def sample_differentiation():
    return SAMPLE_DIFFERENTIATION.copy()


@pytest.fixture
def sample_verdict():
    return SAMPLE_VERDICT.copy()
