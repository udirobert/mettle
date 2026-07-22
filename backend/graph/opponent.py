"""Opponent rehearsal phase.

Roleplays the counterpart in character for rehearsal. Reads the counterpart
profile from state and the latest user turn from the transcript, then
produces an in-character skeptical response. Falls back to a deterministic
persona-conditioned response when no API key is configured.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from .llm import get_llm
from .state import ConversationState

OPPONENT_SYSTEM_PROMPT = """\
You are {counterpart_name}, {counterpart_role}.

You are in a rehearsal. The person across from you is practicing for the \
real meeting. Your job is to be the person they will actually face — not \
a friendly sparring partner.

Your style: {counterpart_style}.
Your leverage: {counterpart_leverage}.
Your concerns: {counterpart_concerns}

Rules:
- Stay in character. Speak as {first_name}, not as an analyst or coach.
- Press on the number they least want to discuss. If they avoid the \
liquidity question, ask it. If they lead with returns, redirect to \
operations.
- Be terse. You do not explain your reasoning. You ask, you wait, \
you push.
- Do not concede unless they actually address your concern. A vague \
answer gets a follow-up, not agreement.
- One response only. Do not write their side of the conversation."""

OPPONENT_USER_TEMPLATE = """\
Their latest turn: "{user_turn}"

Previous turns in this rehearsal:
{transcript_history}

Respond as {first_name}."""

FALLBACK_RESPONSE = (
    "That's the return number. I need to hear about liquidity. "
    "What's changed operationally since the last cycle that means "
    "I should expect distributions on schedule this time?"
)


def _first_name(name: str) -> str:
    return name.split()[0] if name else "the counterpart"


def _format_transcript_history(transcript: list, max_turns: int = 6) -> str:
    recent = transcript[-max_turns:] if len(transcript) > max_turns else transcript
    if not recent:
        return "(this is the first turn)"
    lines = []
    for turn in recent:
        speaker = (
            "You"
            if turn["speaker"] == "user"
            else _first_name(turn.get("speaker", "counterpart"))
        )
        lines.append(f'  {speaker}: "{turn["text"]}"')
    return "\n".join(lines)


def _build_fallback_response(state: ConversationState) -> str:
    """Produce a deterministic response that references the actual user turn."""
    transcript = state.get("transcript", [])
    if not transcript:
        return FALLBACK_RESPONSE

    last_turn = transcript[-1]
    if last_turn["speaker"] != "user":
        return "Your turn."

    text = last_turn["text"].lower()
    profile = state.get("counterpart_profile", {})
    concerns = profile.get("concerns", [])
    first_name = _first_name(profile.get("name", "Elena"))

    # Pick the concern the user seems least prepared for
    if "liquidity" not in text and "distribut" not in text:
        concern = concerns[0] if concerns else "DPI has lagged."
        return f"{first_name}: You haven't addressed {concern.lower()} What's different this time?"
    if "fee" not in text and "step-up" not in text:
        concern = concerns[2] if len(concerns) > 2 else "The fee step-up."
        return f"{first_name}: {concern} Why should I pay more for the same liquidity profile?"
    if "concentrat" not in text and "two positions" not in text:
        concern = concerns[1] if len(concerns) > 1 else "Two positions."
        return f"{first_name}: {concern} What happens to the portfolio if one of them unwinds?"
    return FALLBACK_RESPONSE


def run_opponent(state: ConversationState) -> dict:
    """Produce an in-character counterpart response for rehearsal.

    Reads the latest user turn from the transcript and generates a
    persona-conditioned skeptical response. Falls back to a deterministic
    response that targets the concern the user seems least prepared for.
    """
    transcript = state.get("transcript", [])
    if not transcript or transcript[-1]["speaker"] != "user":
        return {"phase": "rehearsal"}

    last_turn = transcript[-1]["text"]
    profile = state.get("counterpart_profile", {})
    counterpart_name = profile.get("name", "the counterpart")
    counterpart_role = profile.get("role", "")
    counterpart_style = ", ".join(profile.get("style", ["skeptical"]))
    counterpart_leverage = profile.get("leverage", "")
    concerns = profile.get("concerns", [])
    first_name = _first_name(counterpart_name)

    llm = get_llm()
    if llm is None:
        response_text = _build_fallback_response(state)
    else:
        system_prompt = OPPONENT_SYSTEM_PROMPT.format(
            counterpart_name=counterpart_name,
            counterpart_role=counterpart_role,
            counterpart_style=counterpart_style,
            counterpart_leverage=counterpart_leverage,
            counterpart_concerns="\n".join(f"  - {c}" for c in concerns),
            first_name=first_name,
        )
        user_message = OPPONENT_USER_TEMPLATE.format(
            user_turn=last_turn,
            transcript_history=_format_transcript_history(transcript[:-1]),
            first_name=first_name,
        )
        try:
            response = llm.invoke(
                [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_message),
                ]
            )
            response_text = (
                response.content.strip()
                if response.content
                else _build_fallback_response(state)
            )
        except Exception:
            response_text = _build_fallback_response(state)

    from datetime import UTC, datetime

    counterpart_turn = {
        "speaker": "counterpart",
        "text": response_text,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    return {
        "phase": "rehearsal",
        "transcript": [*transcript, counterpart_turn],
    }
