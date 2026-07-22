"""Debrief phase owned by Person A."""

from .state import ConversationState


def run_debrief(state: ConversationState) -> dict:
    """TODO: summarize commitments, unanswered objections, and next actions."""
    return {
        "phase": "debrief",
        "debrief_notes": ["Debrief stub: review transcript and nudges before follow-up."],
    }
