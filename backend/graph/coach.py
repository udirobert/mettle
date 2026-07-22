"""Coach phase owned by Person B."""

from .scenarios import load_scenario
from .state import ConversationState


def run_coach(state: ConversationState) -> dict:
    """Initialize prep from the scenario and retain user-authored overrides.

    TODO(Person B): add a scenario-aware LLM stress test after this deterministic
    baseline is flowing end-to-end through CopilotKit shared state.
    """
    scenario = load_scenario(state.get("scenario_id", "lp_renewal"))
    return {
        **scenario,
        "phase": "prep",
        "user_weak_points": state.get("user_weak_points")
        or scenario["user_weak_points"],
    }
