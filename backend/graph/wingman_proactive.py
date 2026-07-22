"""Proactive Wingman evaluation owned by Person B."""

from datetime import UTC, datetime

from triggers.rules import evaluate_latest_turn

from .state import ConversationState


def evaluate_proactive_nudge(state: ConversationState) -> dict:
    """Run the cheap rules pass before any future LLM escalation."""
    nudge = evaluate_latest_turn(state)
    if nudge is None:
        return {}
    return {"nudges_sent": [*state.get("nudges_sent", []), nudge]}
