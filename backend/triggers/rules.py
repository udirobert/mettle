"""Deterministic first-pass proactive nudge rules.

Rules must remain cheap and conservative: an LLM may enrich a candidate later,
but no model call should be required for every transcript turn.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from graph.state import ConversationState, Nudge

CONCESSION_PHRASES = ("we can accept", "we would accept", "i can commit", "we can commit")
MIN_MONOLOGUE_WORDS = 85


def _recently_sent(state: ConversationState, kind: str) -> bool:
    """Rate-limit one nudge type across the latest three sent nudges."""
    return any(nudge["kind"] == kind for nudge in state.get("nudges_sent", [])[-3:])


def _nudge(kind: Nudge["kind"], message: str, turn_index: int) -> Nudge:
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
    if any(phrase in normalized for phrase in CONCESSION_PHRASES) and not _recently_sent(state, "concession"):
        return _nudge("concession", "You may have made a commitment. Qualify it before moving on.", len(transcript) - 1)
    if len(text.split()) >= MIN_MONOLOGUE_WORDS and not _recently_sent(state, "long_monologue"):
        return _nudge("long_monologue", "Pause and invite their reaction. Do not add another proof point yet.", len(transcript) - 1)

    prior_user_turns = [item["text"].strip().lower() for item in transcript[:-1] if item["speaker"] == "user"]
    if normalized and normalized in prior_user_turns and not _recently_sent(state, "repetition"):
        return _nudge("repetition", "You are repeating a point. Ask what evidence would change their view.", len(transcript) - 1)
    return None
