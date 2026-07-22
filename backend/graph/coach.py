"""Coach phase owned by Person B.

Loads the scenario deterministically, then runs an LLM stress-test that
surfaces blind spots, likely objections, and concrete opening moves.
Falls back to deterministic weak points when no API key is configured.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from .llm import get_llm
from .scenarios import load_scenario
from .state import CoachAnalysis, ConversationState

COACH_SYSTEM_PROMPT = """\
You are a high-stakes conversation coach. Your job is to prepare someone \
for a meeting they cannot afford to get wrong.

You will receive the scenario context: stakes, counterpart profile, known \
objections, and the user's self-identified weak points.

Your output must be specific and tactical — not generic advice. Name the \
exact thing they are not seeing (blind spots), the exact objection the \
counterpart will lead with (likely objections), and the exact first move \
they should make (opening strategy). Reference the specific facts of the \
scenario, not abstract principles.

Be direct. If their position has a hole, say where it is."""

COACH_USER_TEMPLATE = """\
Scenario: {scenario_id}
Stakes: {stakes}

Counterpart: {counterpart_name} — {counterpart_role}
Style: {counterpart_style}
Leverage: {counterpart_leverage}
Known concerns:
{counterpart_concerns}

User's self-identified weak points:
{user_weak_points}

Analyze this position. What are they not seeing? What will the counterpart \
lead with? What should they say first?"""

FALLBACK_ANALYSIS: CoachAnalysis = {
    "blind_spots": [
        "The liquidity timeline is the real objection — DPI is the proxy, not the root.",
        "A reduced allocation is the counterpart's BATNA, not their floor. They may test it.",
    ],
    "concrete_moves": [
        "Open with the operational change that addresses liquidity, not the return number.",
        "Name the full $40M renewal ask explicitly in the first 90 seconds.",
        "Pre-commit to a specific liquidity milestone with a date, not a range.",
    ],
    "likely_objections": [
        "Why should we believe the liquidity timeline this time?",
        "The fee step-up doesn't match the liquidity delivered so far.",
        "Two positions are doing all the work — what happens if one unwinds?",
    ],
    "opening_strategy": (
        "Acknowledge the prior gap, state the operational change, then name the ask. "
        "Do not lead with portfolio performance."
    ),
}


def _format_concerns(concerns: list[str]) -> str:
    return "\n".join(f"  - {c}" for c in concerns)


def _format_weak_points(weak_points: list[str]) -> str:
    return "\n".join(f"  - {w}" for w in weak_points)


def _run_llm_stress_test(scenario: dict, weak_points: list[str]) -> CoachAnalysis:
    """Call the LLM to produce a structured stress-test analysis.

    Falls back to deterministic analysis on any error — missing key, auth
    failure, network issue, malformed response. The graph must never crash
    because the LLM is unavailable.
    """
    llm = get_llm()
    if llm is None:
        return FALLBACK_ANALYSIS

    profile = scenario["counterpart_profile"]
    user_message = COACH_USER_TEMPLATE.format(
        scenario_id=scenario["scenario_id"],
        stakes=scenario["stakes"],
        counterpart_name=profile["name"],
        counterpart_role=profile["role"],
        counterpart_style=", ".join(profile["style"]),
        counterpart_leverage=profile["leverage"],
        counterpart_concerns=_format_concerns(profile["concerns"]),
        user_weak_points=_format_weak_points(weak_points),
    )

    try:
        structured_llm = llm.with_structured_output(CoachAnalysis)
        result = structured_llm.invoke(
            [
                SystemMessage(content=COACH_SYSTEM_PROMPT),
                HumanMessage(content=user_message),
            ]
        )
        return result  # type: ignore[return-value]
    except Exception:
        return FALLBACK_ANALYSIS


def run_coach(state: ConversationState) -> dict:
    """Initialize prep from the scenario, then run the LLM stress-test.

    The deterministic scenario load happens first so shared state is always
    populated. The LLM stress-test enriches the prep with structured analysis
    that the proactive Wingman reads later to calibrate nudge sensitivity.
    """
    scenario = load_scenario(state.get("scenario_id", "lp_renewal"))
    weak_points = state.get("user_weak_points") or scenario["user_weak_points"]

    analysis = _run_llm_stress_test(scenario, weak_points)

    return {
        **scenario,
        "phase": "prep",
        "user_weak_points": weak_points,
        "coach_analysis": analysis,
    }
