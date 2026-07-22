"""Coach phase owned by Person A."""

from .llm import complete
from .scenarios import load_scenario
from .state import ConversationState

_STRESS_TEST_SYSTEM = (
    "You are a preparation coach for high-stakes conversations. Given a "
    "scenario, produce the 4 most dangerous weak points the user is likely to "
    "show in THIS conversation. Each weak point is one sentence naming the "
    "failure pattern, then ' — ' and a concrete in-the-moment cue to counter "
    "it. Return exactly one weak point per line, no numbering, no extra text."
)


def run_coach(state: ConversationState) -> dict:
    """Initialize prep from the scenario, then sharpen weak points with an LLM.

    The deterministic scenario baseline always loads first, so prep works with
    no credentials. User-authored overrides are retained.
    """
    scenario = load_scenario(state.get("scenario_id", "lp_renewal"))

    weak_points = state.get("user_weak_points") or scenario["user_weak_points"]

    profile = scenario["counterpart_profile"]
    stress_test = complete(
        _STRESS_TEST_SYSTEM,
        (
            f"Stakes: {scenario['stakes']}\n"
            f"Counterpart: {profile['name']} ({profile['role']}), "
            f"style: {', '.join(profile['style'])}.\n"
            f"Counterpart concerns: {'; '.join(profile['concerns'])}\n"
            f"Known tendencies of the user: {'; '.join(weak_points)}"
        ),
        temperature=0.4,
    )
    if stress_test:
        weak_points = [line.strip() for line in stress_test.splitlines() if line.strip()]

    return {
        **scenario,
        "phase": "prep",
        "user_weak_points": weak_points,
    }
