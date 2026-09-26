from langchain_core.utils.function_calling import convert_to_openai_tool

from graph.coach import FALLBACK_ANALYSIS
from graph.state import CoachAnalysis


def test_fallback_has_speakable_if_then_lines():
    lines = FALLBACK_ANALYSIS["if_then"]
    assert 2 <= len(lines) <= 4
    for line in lines:
        assert line["trigger"].strip()
        assert line["response"].strip()


def test_coach_schema_converts_for_structured_output():
    params = convert_to_openai_tool(CoachAnalysis)["function"]["parameters"]
    item = params["properties"]["if_then"]["items"]
    assert set(item["required"]) == {"trigger", "response"}
