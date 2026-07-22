"""Coach phase owned by Person B.

Replace the deterministic output with scenario-aware LLM analysis once the
end-to-end shared-state surface is proven.
"""

from .state import ConversationState


def run_coach(state: ConversationState) -> dict:
    """Prepare the user and persist the prep context for downstream phases."""
    return {
        "phase": "prep",
        "user_weak_points": state.get("user_weak_points")
        or [
            "May defend the headline return before addressing liquidity concerns.",
            "May over-explain portfolio detail instead of naming the renewal ask.",
        ],
    }
