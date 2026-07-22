"""Deterministic first-pass proactive nudge rules.

Rules must remain cheap and conservative: an LLM may enrich a candidate later,
but no model call should be required for every transcript turn.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from graph.state import ConversationState, Nudge

CONCESSION_PHRASES = (
    "we can accept",
    "we would accept",
    "i can commit",
    "we can commit",
    "we can do",
    "i can do",
)
MIN_MONOLOGUE_WORDS = 85
MIN_TURNS_BETWEEN_SAME_NUDGE = 3


def _is_rate_limited(state: ConversationState, kind: str, turn_index: int) -> bool:
    """Avoid duplicates and suppress the same pattern for a few new turns."""
    for nudge in reversed(state.get("nudges_sent", [])):
        if nudge["kind"] != kind:
            continue
        return turn_index - nudge["source_turn_index"] < MIN_TURNS_BETWEEN_SAME_NUDGE
    return False


def _nudge(kind: str, message: str, turn_index: int) -> Nudge:
    return {
        "id": str(uuid4()),
        "kind": kind,
        "message": message,
        "timestamp": datetime.now(UTC).isoformat(),
        "source_turn_index": turn_index,
    }


def evaluate_latest_turn(state: ConversationState) -> Nudge | None:
    """Return at most one useful nudge for the newest user transcript turn."""
    transcript = state.get("transcript", [])
    if not transcript:
        return None
    turn = transcript[-1]
    if turn["speaker"] != "user":
        return None

    text = turn["text"].strip()
    normalized = text.lower()
    turn_index = len(transcript) - 1
    if any(phrase in normalized for phrase in CONCESSION_PHRASES):
        if _is_rate_limited(state, "concession", turn_index):
            return None
        return _nudge(
            "concession",
            "You may have made a commitment. Qualify it before moving on.",
            turn_index,
        )
    if len(text.split()) >= MIN_MONOLOGUE_WORDS:
        if _is_rate_limited(state, "long_monologue", turn_index):
            return None
        return _nudge(
            "long_monologue",
            "Pause and invite their reaction. Do not add another proof point yet.",
            turn_index,
        )

    prior_user_turns = [
        item["text"].strip().lower()
        for item in transcript[:-1]
        if item["speaker"] == "user"
    ]
    if (
        normalized
        and normalized in prior_user_turns
        and not _is_rate_limited(state, "repetition", turn_index)
    ):
        return _nudge(
            "repetition",
            "You are repeating a point. Ask what evidence would change their view.",
            turn_index,
        )
    return None
