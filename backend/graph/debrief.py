"""Debrief phase placeholder shared by both owners."""

from .state import ConversationState


def run_debrief(state: ConversationState) -> dict:
    """TODO: summarize commitments, unanswered objections, and next actions."""
    return {
        "phase": "debrief",
        "debrief_notes": [
            "Debrief stub: review transcript and nudges before follow-up."
        ],
    }
