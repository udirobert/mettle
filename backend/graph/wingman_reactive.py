"""Reactive Wingman phase.

Interrupt-based quick answer: the user types a fragment mid-conversation,
and the agent produces a short, context-grounded tactical reply. Falls back
to a deterministic answer referencing the query and counterpart concerns
when no API key is configured.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.types import interrupt

from .llm import get_llm
from .state import ConversationState

REACTIVE_SYSTEM_PROMPT = """\
You are a live conversation wingman. The user is in a high-stakes meeting \
and needs a fast, specific answer to a question they just typed.

Rules:
- Maximum three sentences. This is read mid-conversation.
- Answer the specific question, do not give general advice.
- Reference the counterpart's known concerns when relevant.
- Give the user something they can say out loud, not an analysis.
- If the question is vague, give them a calibrated question to ask instead."""

REACTIVE_USER_TEMPLATE = """\
The user's quick question: "{query}"

Conversation stakes: {stakes}
Counterpart: {counterpart_name}
Counterpart's known concerns: {concerns}
Recent transcript:
{transcript_context}

Blind spots from prep: {blind_spots}

Write a short, specific answer the user can use right now:"""

FALLBACK_REPLY = (
    "Acknowledge what they just said, name the specific concern underneath it, "
    "then ask what would make this decision simple for them."
)

_STOP_WORDS = frozenset(
    {
        "the",
        "and",
        "for",
        "are",
        "but",
        "not",
        "you",
        "all",
        "can",
        "has",
        "her",
        "was",
        "one",
        "our",
        "out",
        "day",
        "had",
        "how",
        "its",
        "may",
        "new",
        "now",
        "old",
        "see",
        "way",
        "who",
        "did",
        "get",
        "him",
        "let",
        "say",
        "she",
        "too",
        "use",
        "that",
        "with",
        "have",
        "from",
        "this",
        "will",
        "your",
        "than",
        "them",
        "been",
        "what",
        "when",
        "more",
        "does",
        "also",
        "just",
        "very",
        "after",
        "before",
        "most",
        "into",
        "about",
        "could",
        "would",
        "which",
        "their",
        "there",
        "other",
    }
)


def _extract_keywords(text: str) -> list[str]:
    """Extract meaningful keywords from text, filtering stop words and short words."""
    words = text.lower().replace("-", " ").split()
    return [w for w in words if len(w) > 2 and w not in _STOP_WORDS]


def _format_list(items: list[str]) -> str:
    return "; ".join(items) if items else "(none)"


def _format_transcript_context(transcript: list, max_turns: int = 4) -> str:
    recent = transcript[-max_turns:] if len(transcript) > max_turns else transcript
    if not recent:
        return "(no turns yet)"
    lines = []
    for turn in recent:
        speaker = "You" if turn["speaker"] == "user" else turn.get("speaker", "them")
        lines.append(f"  {speaker}: {turn['text']}")
    return "\n".join(lines)


def _build_fallback_reply(state: ConversationState) -> str:
    """Produce a deterministic reply that references the actual query and concerns."""
    query = (state.get("open_reactive_query") or "").lower()
    profile = state.get("counterpart_profile", {})
    concerns = profile.get("concerns", [])
    counterpart_name = profile.get("name", "the counterpart")
    first_name = counterpart_name.split()[0] if counterpart_name else "they"

    if not query:
        return FALLBACK_REPLY

    # Match the query to the most relevant concern and give tactical advice
    query_words = _extract_keywords(query)
    for concern in concerns:
        concern_keywords = _extract_keywords(concern)
        if any(word in query_words for word in concern_keywords):
            return (
                f"Address {concern}. Be specific about what's changed or what you can commit to. "
                f"Then pause and let {counterpart_name} respond."
            )

    # No clear concern match — give a generic but actionable reply
    return (
        f"Acknowledge what {first_name} just said, then name the concern underneath it. "
        "Give them something specific they can react to, not an explanation."
    )


def wait_for_reactive_query(state: ConversationState) -> dict:
    """Pause until the UI resumes this graph with the user's quick question."""
    query = interrupt(
        {
            "kind": "reactive_query",
            "prompt": "What do you need to say next?",
            "phase": state["phase"],
        }
    )
    return {"open_reactive_query": str(query)}


def answer_reactive_query(state: ConversationState) -> dict:
    """Produce a short, context-grounded tactical answer to the user's query.

    Uses the transcript, counterpart profile, and coach analysis to generate
    a specific reply the user can act on immediately. Falls back to a
    deterministic concern-keyword reply when no API key is configured.
    """
    query = state.get("open_reactive_query") or ""

    llm = get_llm()
    if llm is None:
        reply = _build_fallback_reply(state)
    else:
        profile = state.get("counterpart_profile", {})
        analysis = state.get("coach_analysis", {})

        user_message = REACTIVE_USER_TEMPLATE.format(
            query=query,
            stakes=state.get("stakes", "(unknown)"),
            counterpart_name=profile.get("name", "the counterpart"),
            concerns=_format_list(profile.get("concerns", [])),
            transcript_context=_format_transcript_context(state.get("transcript", [])),
            blind_spots=_format_list(analysis.get("blind_spots", [])),
        )

        try:
            response = llm.invoke(
                [
                    SystemMessage(content=REACTIVE_SYSTEM_PROMPT),
                    HumanMessage(content=user_message),
                ]
            )
            reply = (
                response.content.strip()
                if response.content
                else _build_fallback_reply(state)
            )
        except Exception:
            reply = _build_fallback_reply(state)

    return {
        "reactive_reply": reply,
        "open_reactive_query": None,
        "awaiting_reactive_query": False,
        "reactive_query_prefill": None,
    }
