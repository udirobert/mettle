"""Opponent rehearsal phase owned by Person A.

Typed-rehearsal path. The voice rehearsal path (Deepgram Voice Agent in the
browser) bypasses this node entirely and writes both sides of the exchange into
``state.transcript`` directly, so downstream phases see one transcript shape
regardless of input mode.
"""

from datetime import datetime, timezone

from .llm import complete
from .state import ConversationState, TranscriptTurn

_OPENING_LINE = (
    "Before we discuss a new commitment, explain why we should treat the "
    "liquidity timeline as credible this time."
)

_PERSONA_SYSTEM = (
    "You are {name}, {role}, in a live high-stakes meeting. Style: {style}. "
    "Your leverage: {leverage} Your concerns: {concerns}\n"
    "Stay in character. You are not a coach and not friendly. Be terse — two "
    "to four sentences. Push back on vague claims, ask for specifics, and do "
    "not concede until the user earns it with concrete answers. Never mention "
    "being an AI or a rehearsal."
)


def _turn(speaker: str, text: str) -> TranscriptTurn:
    return {
        "speaker": speaker,  # type: ignore[typeddict-item]
        "text": text,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def run_opponent(state: ConversationState) -> dict:
    """Produce a persona-conditioned skeptical counterpart turn."""
    transcript = list(state.get("transcript") or [])
    profile = state.get("counterpart_profile") or {}

    # Open the meeting with the counterpart's opening line (generated for
    # custom scenarios, scenario seed otherwise).
    if not transcript:
        opening = str(profile.get("opening_line") or _OPENING_LINE)
        return {
            "phase": "rehearsal",
            "transcript": [_turn("counterpart", opening)],
        }

    # Only respond when the user has made a move since Elena's last line.
    if transcript[-1]["speaker"] != "user":
        return {"phase": "rehearsal"}

    system = _PERSONA_SYSTEM.format(
        name=profile.get("name", "Elena Park"),
        role=profile.get("role", "CIO, Northstar Foundation"),
        style=", ".join(profile.get("style", ["analytical", "terse", "skeptical"])),
        leverage=profile.get("leverage", "You can renew at a reduced allocation."),
        concerns="; ".join(profile.get("concerns", [])),
    )
    dialogue = "\n".join(
        f"{'You' if t['speaker'] == 'counterpart' else 'Fund manager'}: {t['text']}"
        for t in transcript[-12:]
    )
    reply = complete(
        system,
        f"The meeting so far:\n{dialogue}\n\nRespond in character as your next line only.",
        temperature=0.8,
    ) or (
        "That is not an answer to my question. Give me the operational change "
        "and the date it took effect."
    )

    return {
        "phase": "rehearsal",
        "transcript": transcript + [_turn("counterpart", reply)],
    }
