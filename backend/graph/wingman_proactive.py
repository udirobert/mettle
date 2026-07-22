"""Proactive Wingman evaluation owned by Person B."""

from datetime import UTC, datetime

from triggers.rules import evaluate_latest_turn

from .state import ConversationState, TranscriptTurn


def evaluate_proactive_nudge(state: ConversationState) -> dict:
    """Run the cheap rules pass before any future LLM escalation."""
    nudge = evaluate_latest_turn(state)
    if nudge is None:
        return {}
    return {"nudges_sent": [*state.get("nudges_sent", []), nudge]}


def ingest_transcript_turn(
    state: ConversationState,
    *,
    speaker: TranscriptTurn["speaker"],
    text: str,
    timestamp: str | None = None,
) -> dict:
    """Append one finalized text or STT turn and evaluate a low-cost nudge.

    This is intentionally transport-agnostic. The typed UI can call it through
    the graph today, and the LiveKit adapter can call it when a final STT result
    arrives later. Partial STT hypotheses must not be sent here.
    """
    clean_text = text.strip()
    if not clean_text:
        return {}

    turn: TranscriptTurn = {
        "speaker": speaker,
        "text": clean_text,
        "timestamp": timestamp or datetime.now(UTC).isoformat(),
    }
    transcript = [*state.get("transcript", []), turn]
    candidate_state = {**state, "transcript": transcript}
    nudge = evaluate_latest_turn(candidate_state)
    update: dict = {"transcript": transcript, "nudges_sent": [*state.get("nudges_sent", [])]}
    if nudge is not None:
        update["nudges_sent"].append(nudge)
    return update
