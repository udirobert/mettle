"""Proactive Wingman evaluation owned by Person B.

Two-stage pipeline:
  1. Cheap deterministic rules pass (triggers/rules.py) — no LLM call per turn.
  2. LLM enrichment — only when a candidate nudge fires, to replace the generic
     rules-based message with context-aware advice. Falls back to the rules
     message when no API key is configured.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Literal

from copilotkit import a2ui
from langchain_core.callbacks import dispatch_custom_event
from langchain_core.messages import HumanMessage, SystemMessage

from triggers.rules import evaluate_latest_turn

from .llm import get_llm
from .state import ConversationState, Nudge, TranscriptTurn

NUDGE_HINTS: dict[str, str] = {
    "concession": "Qualify it before moving on.",
    "long_monologue": "Pause and invite their reaction.",
    "repetition": "Ask what evidence would change their view.",
    "timing": "Check if the moment is right.",
    "other": "Consider the implication before continuing.",
}

Speaker = Literal["user", "counterpart", "system"]

ENRICHMENT_SYSTEM_PROMPT = """\
You are a live conversation wingman. A behavioral pattern was just detected \
in what the user said. Your job is to write a short, specific nudge that \
helps them course-correct right now.

Rules:
- Maximum two sentences. This is read mid-conversation.
- Reference the specific thing they just said, not abstract advice.
- Tell them what to do next, not what they did wrong.
- If the counterpart has a known concern that connects to this pattern, \
name the connection.
- Do not repeat information they already know from prep."""

ENRICHMENT_USER_TEMPLATE = """\
Pattern detected: {kind}
What the user just said: "{turn_text}"

Conversation stakes: {stakes}
Counterpart: {counterpart_name}
Counterpart's known concerns: {concerns}
User's blind spots from prep: {blind_spots}

Write the nudge message:"""


def _format_list(items: list[str]) -> str:
    return "; ".join(items) if items else "(none)"


def _enrich_nudge(
    candidate: Nudge,
    state: ConversationState,
    turn_text: str,
) -> Nudge:
    """Replace the generic rules message with an LLM-enriched one.

    Falls back to the rules-based message on any error — the nudge must
    still fire even if the LLM is unavailable.
    """
    llm = get_llm()
    if llm is None:
        return candidate

    profile = state.get("counterpart_profile", {})
    analysis = state.get("coach_analysis", {})

    user_message = ENRICHMENT_USER_TEMPLATE.format(
        kind=candidate["kind"].replace("_", " "),
        turn_text=turn_text,
        stakes=state.get("stakes", "(unknown)"),
        counterpart_name=profile.get("name", "the counterpart"),
        concerns=_format_list(profile.get("concerns", [])),
        blind_spots=_format_list(analysis.get("blind_spots", [])),
    )

    try:
        response = llm.invoke(
            [
                SystemMessage(content=ENRICHMENT_SYSTEM_PROMPT),
                HumanMessage(content=user_message),
            ]
        )
        enriched_message = (
            response.content.strip() if response.content else candidate["message"]
        )
        return {**candidate, "message": enriched_message}
    except Exception:
        return candidate


def build_nudge_surface(nudge: Nudge) -> str:
    """Generate an A2UI v0.9 surface payload for the latest nudge."""
    surface_id = "nudge-surface"
    catalog_id = "mettle-nudge-catalog"
    return a2ui.render(
        [
            a2ui.create_surface(surface_id, catalog_id),
            a2ui.update_components(
                surface_id,
                [
                    {
                        "id": "root",
                        "component": "NudgeCard",
                        "kind": nudge["kind"],
                        "message": nudge["message"],
                        "hint": NUDGE_HINTS.get(nudge["kind"], ""),
                        "actionLabel": "Get a reframe",
                    }
                ],
            ),
        ]
    )


def emit_nudge_surface(nudge: Nudge) -> None:
    """Emit the latest nudge as an AG-UI A2UI surface message.

    This is a no-op when called outside a LangGraph run (e.g. in unit tests),
    because dispatch_custom_event requires a parent run id.
    """
    try:
        dispatch_custom_event(
            "copilotkit_manually_emit_message",
            {
                "message_id": str(uuid.uuid4()),
                "message": build_nudge_surface(nudge),
            },
        )
    except RuntimeError:
        pass


def evaluate_proactive_nudge(state: ConversationState) -> dict:
    """Run the cheap rules pass, then enrich any candidate nudge via LLM."""
    candidate = evaluate_latest_turn(state)
    if candidate is None:
        return {}

    transcript = state.get("transcript", [])
    turn_text = transcript[candidate["source_turn_index"]]["text"] if transcript else ""

    nudge = _enrich_nudge(candidate, state, turn_text)
    emit_nudge_surface(nudge)
    return {"nudges_sent": [*state.get("nudges_sent", []), nudge]}


def ingest_transcript_turn(
    state: ConversationState,
    *,
    speaker: Speaker,
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
    candidate = evaluate_latest_turn(candidate_state)

    update: dict = {
        "transcript": transcript,
        "nudges_sent": [*state.get("nudges_sent", [])],
    }
    if candidate is not None:
        nudge = _enrich_nudge(
            candidate, {**candidate_state, "transcript": transcript}, clean_text
        )
        update["nudges_sent"].append(nudge)
        emit_nudge_surface(nudge)
    return update
