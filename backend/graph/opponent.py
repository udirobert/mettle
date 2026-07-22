"""Opponent rehearsal phase owned by Person A."""

from .state import ConversationState


def run_opponent(state: ConversationState) -> dict:
    """TODO(Person A): produce a persona-conditioned skeptical response."""
    return {"phase": "rehearsal"}
