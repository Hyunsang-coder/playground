"""Unit tests for pure functions — no external API calls."""

import json
import pytest
from pydantic import ValidationError

from analyzer import IdeaAnalyzer


# ===== _parse_json_safe =====

class TestParseJsonSafe:
    """Tests for the robust JSON parser."""

    def setup_method(self):
        self.analyzer = IdeaAnalyzer(anthropic_api_key="", tavily_api_key="")
        self.fallback = {"fallback": True}

    def test_valid_json(self):
        result = self.analyzer._parse_json_safe('{"key": "value", "num": 42}', self.fallback)
        assert result == {"key": "value", "num": 42}

    def test_valid_nested_json(self):
        text = '{"scores": {"a": 1, "b": 2}, "list": [1, 2, 3]}'
        result = self.analyzer._parse_json_safe(text, self.fallback)
        assert result["scores"]["a"] == 1
        assert result["list"] == [1, 2, 3]

    def test_markdown_code_block(self):
        text = '```json\n{"key": "value"}\n```'
        result = self.analyzer._parse_json_safe(text, self.fallback)
        assert result == {"key": "value"}

    def test_markdown_code_block_no_lang(self):
        text = '```\n{"key": "value"}\n```'
        result = self.analyzer._parse_json_safe(text, self.fallback)
        assert result == {"key": "value"}

    def test_text_before_and_after_json(self):
        text = 'Here is my answer:\n{"verdict": "GO", "score": 85}\nThat is my response.'
        result = self.analyzer._parse_json_safe(text, self.fallback)
        assert result["verdict"] == "GO"
        assert result["score"] == 85

    def test_garbage_returns_fallback(self):
        result = self.analyzer._parse_json_safe("this is not json at all", self.fallback)
        assert result == self.fallback

    def test_empty_string_returns_fallback(self):
        result = self.analyzer._parse_json_safe("", self.fallback)
        assert result == self.fallback

    def test_nested_braces_in_text(self):
        text = 'Some text {"outer": {"inner": "value"}} more text'
        result = self.analyzer._parse_json_safe(text, self.fallback)
        assert result["outer"]["inner"] == "value"

    def test_json_with_korean(self):
        text = '{"summary": "경쟁이 치열합니다", "score": 30}'
        result = self.analyzer._parse_json_safe(text, self.fallback)
        assert result["summary"] == "경쟁이 치열합니다"

    def test_malformed_json_missing_brace_returns_fallback(self):
        text = '{"key": "value"'
        result = self.analyzer._parse_json_safe(text, self.fallback)
        assert result == self.fallback


# ===== _fallback_feasibility =====

class TestFallbackFeasibility:

    def setup_method(self):
        self.analyzer = IdeaAnalyzer(anthropic_api_key="", tavily_api_key="")

    def test_returns_correct_structure(self):
        result = self.analyzer._fallback_feasibility("test idea")
        assert result["overall_feasibility"] == "partial"
        assert result["score"] == 50
        assert isinstance(result["tech_requirements"], list)
        assert isinstance(result["key_risks"], list)
        assert "time_estimate" in result
        assert "summary" in result

    def test_required_keys_present(self):
        result = self.analyzer._fallback_feasibility("anything")
        required = {"overall_feasibility", "score", "tech_requirements", "key_risks", "time_estimate", "summary"}
        assert required.issubset(set(result.keys()))


# ===== _fallback_differentiation =====

class TestFallbackDifferentiation:

    def setup_method(self):
        self.analyzer = IdeaAnalyzer(anthropic_api_key="", tavily_api_key="")

    def test_blue_ocean_when_no_competitors(self):
        comps = {"raw_count": 0}
        gh = {"total_count": 0}
        result = self.analyzer._fallback_differentiation("idea", comps, gh)
        assert result["competition_level"] == "blue_ocean"
        assert result["competition_score"] == 100

    def test_moderate_with_some_competitors(self):
        comps = {"raw_count": 5}
        gh = {"total_count": 5}
        result = self.analyzer._fallback_differentiation("idea", comps, gh)
        assert result["competition_level"] == "moderate"
        assert result["competition_score"] == 50

    def test_red_ocean_with_many_competitors(self):
        comps = {"raw_count": 15}
        gh = {"total_count": 10}
        result = self.analyzer._fallback_differentiation("idea", comps, gh)
        assert result["competition_level"] == "red_ocean"
        assert result["competition_score"] == max(0, 100 - 25 * 5)

    def test_score_clamped_at_zero(self):
        comps = {"raw_count": 50}
        gh = {"total_count": 50}
        result = self.analyzer._fallback_differentiation("idea", comps, gh)
        assert result["competition_score"] == 0

    def test_required_keys_present(self):
        result = self.analyzer._fallback_differentiation("idea", {"raw_count": 0}, {"total_count": 0})
        required = {"competition_level", "competition_score", "existing_solutions", "unique_angles",
                     "devil_arguments", "pivot_suggestions", "summary"}
        assert required.issubset(set(result.keys()))


# ===== _fallback_verdict =====

class TestFallbackVerdict:

    def setup_method(self):
        self.analyzer = IdeaAnalyzer(anthropic_api_key="", tavily_api_key="")

    def test_go_when_high_scores(self):
        feas = {"score": 80}
        diff = {"competition_score": 80}
        result = self.analyzer._fallback_verdict(feas, diff)
        assert result["verdict"] == "GO"
        assert result["overall_score"] == 80

    def test_pivot_when_mid_scores(self):
        feas = {"score": 50}
        diff = {"competition_score": 50}
        result = self.analyzer._fallback_verdict(feas, diff)
        assert result["verdict"] == "PIVOT"
        assert result["overall_score"] == 50

    def test_kill_when_low_scores(self):
        feas = {"score": 20}
        diff = {"competition_score": 20}
        result = self.analyzer._fallback_verdict(feas, diff)
        assert result["verdict"] == "KILL"
        assert result["overall_score"] == 20

    def test_go_boundary_at_70(self):
        feas = {"score": 70}
        diff = {"competition_score": 70}
        result = self.analyzer._fallback_verdict(feas, diff)
        assert result["verdict"] == "GO"

    def test_pivot_boundary_at_40(self):
        feas = {"score": 40}
        diff = {"competition_score": 40}
        result = self.analyzer._fallback_verdict(feas, diff)
        assert result["verdict"] == "PIVOT"

    def test_kill_boundary_below_40(self):
        feas = {"score": 39}
        diff = {"competition_score": 39}
        result = self.analyzer._fallback_verdict(feas, diff)
        assert result["verdict"] == "KILL"

    def test_uses_default_50_when_missing_scores(self):
        result = self.analyzer._fallback_verdict({}, {})
        assert result["overall_score"] == 50
        assert result["verdict"] == "PIVOT"

    def test_required_keys_present(self):
        result = self.analyzer._fallback_verdict({"score": 60}, {"competition_score": 60})
        required = {"verdict", "confidence", "overall_score", "scores", "one_liner", "recommendation", "alternative_ideas"}
        assert required.issubset(set(result.keys()))

    def test_scores_sub_keys(self):
        result = self.analyzer._fallback_verdict({"score": 60}, {"competition_score": 60})
        scores = result["scores"]
        assert all(k in scores for k in ["competition", "feasibility", "differentiation", "timing"])


# ===== Pydantic AnalyzeRequest Validation =====

class TestAnalyzeRequestValidation:

    def test_valid_request(self):
        from main import AnalyzeRequest
        req = AnalyzeRequest(idea="AI 코드 리뷰 도구", mode="hackathon")
        assert req.idea == "AI 코드 리뷰 도구"
        assert req.mode == "hackathon"

    def test_valid_modes(self):
        from main import AnalyzeRequest
        for mode in ["hackathon", "startup", "sideproject"]:
            req = AnalyzeRequest(idea="test idea", mode=mode)
            assert req.mode == mode

    def test_empty_idea_raises(self):
        from main import AnalyzeRequest
        with pytest.raises(ValidationError):
            AnalyzeRequest(idea="", mode="hackathon")

    def test_whitespace_only_idea_raises(self):
        from main import AnalyzeRequest
        with pytest.raises(ValidationError):
            AnalyzeRequest(idea="   ", mode="hackathon")

    def test_idea_too_long_raises(self):
        from main import AnalyzeRequest
        with pytest.raises(ValidationError):
            AnalyzeRequest(idea="a" * 501, mode="hackathon")

    def test_idea_exactly_500_chars_ok(self):
        from main import AnalyzeRequest
        req = AnalyzeRequest(idea="a" * 500, mode="hackathon")
        assert len(req.idea) == 500

    def test_invalid_mode_raises(self):
        from main import AnalyzeRequest
        with pytest.raises(ValidationError):
            AnalyzeRequest(idea="valid idea", mode="invalid_mode")

    def test_default_mode_is_hackathon(self):
        from main import AnalyzeRequest
        req = AnalyzeRequest(idea="valid idea")
        assert req.mode == "hackathon"

    def test_idea_stripped(self):
        from main import AnalyzeRequest
        req = AnalyzeRequest(idea="  hello world  ", mode="hackathon")
        assert req.idea == "hello world"
