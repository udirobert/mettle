"""Debrief phase.

Post-conversation synthesis: reads the full transcript, nudges sent, and
coach analysis to produce a structured debrief. Surfaces commitments made,
objections left unresolved, and concrete next actions. Falls back to a
deterministic summary when no API key is configured.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from .llm import get_llm
from .state import ConversationState

DEBRIEF_SYSTEM_PROMPT = """\
You are a post-conversation analyst. A high-stakes meeting just ended. \
Your job is to turn the transcript into a structured debrief that the \
user can act on before the next touchpoint.

Rules:
- Be specific. Reference actual words from the transcript, not summaries.
- Separate commitments (things either side agreed to) from open objections \
(things raised but not resolved).
- Next actions must be concrete: who does what, by when if mentioned.
- Maximum 8 notes total. Prioritize the highest-leverage items.
- If a nudge was sent during the conversation, note whether the pattern \
it flagged was addressed or left open.
- Do not invent commitments or objections that are not in the transcript."""

DEBRIEF_USER_TEMPLATE = """\
Stakes: {stakes}
Counterpart: {counterpart_name}

Full transcript:
{transcript_text}

Nudges sent during conversation:
{nudges_text}

Coach prep notes (blind spots and likely objections):
{prep_text}

Produce a list of concise debrief notes. Each note should be one sentence \
capturing a commitment, an open objection, or a next action. Output 3-8 notes, \
one per line, no numbering or bullet prefixes."""

FALLBACK_NOTES = [
    "Review the transcript for any commitments made on either side and confirm them in writing.",
    "Identify objections that were raised but not fully resolved and prepare specific responses.",
    "Send a follow-up within 24 hours that names the ask explicitly and addresses the top concern.",
]


def _format_transcript(transcript: list) -> str:
    if not transcript:
        return "(no turns captured)"
    lines = []
    for turn in transcript:
        speaker = (
            "You" if turn["speaker"] == "user" else turn.get("speaker", "Counterpart")
        )
        lines.append(f"  {speaker}: {turn['text']}")
    return "\n".join(lines)


def _format_nudges(nudges: list) -> str:
    if not nudges:
        return "(none)"
    return "; ".join(f"{n['kind'].replace('_', ' ')}: {n['message']}" for n in nudges)


def _format_prep(analysis: dict) -> str:
    if not analysis:
        return "(no prep notes)"
    parts = []
    if analysis.get("blind_spots"):
        parts.append("Blind spots: " + "; ".join(analysis["blind_spots"]))
    if analysis.get("likely_objections"):
        parts.append("Likely objections: " + "; ".join(analysis["likely_objections"]))
    return "\n".join(parts) if parts else "(no prep notes)"


def _build_deterministic_notes(state: ConversationState) -> list[str]:
    """Extract basic debrief notes from the transcript without an LLM."""
    transcript = state.get("transcript", [])
    nudges = state.get("nudges_sent", [])
    profile = state.get("counterpart_profile", {})
    concerns = profile.get("concerns", [])

    notes: list[str] = []

    counterpart_turns = [t for t in transcript if t["speaker"] != "user"]
    user_turns = [t for t in transcript if t["speaker"] == "user"]

    if counterpart_turns:
        last_counterpart = counterpart_turns[-1]
        notes.append(
            f"Last thing {profile.get('name', 'the counterpart')} said: "
            f'"{last_counterpart["text"][:120]}"'
        )

    concession_nudges = [n for n in nudges if n["kind"] == "concession"]
    if concession_nudges:
        notes.append(
            f"{len(concession_nudges)} commitment(s) flagged during conversation — "
            "confirm or qualify in follow-up."
        )

    if concerns and user_turns:
        all_user_text = " ".join(t["text"].lower() for t in user_turns)
        unaddressed = [
            c
            for c in concerns
            if not any(word in all_user_text for word in c.lower().split()[:3])
        ]
        if unaddressed:
            notes.append(f"Potentially unaddressed: {unaddressed[0]}")

    if not notes:
        notes = list(FALLBACK_NOTES)
    else:
        notes.append("Send a follow-up within 24 hours that names the ask explicitly.")

    return notes


def run_debrief(state: ConversationState) -> dict:
    """Summarize commitments, unanswered objections, and next actions.

    Reads the full transcript, nudges, and coach analysis to produce a
    structured debrief. Falls back to deterministic extraction when no
    API key is configured.
    """
    transcript = state.get("transcript", [])

    if not transcript:
        return {
            "phase": "debrief",
            "debrief_notes": [
                "No transcript turns were captured. Review your notes and record "
                "commitments and open items before they fade.",
            ],
        }

    llm = get_llm()
    if llm is None:
        notes = _build_deterministic_notes(state)
    else:
        profile = state.get("counterpart_profile", {})
        analysis = state.get("coach_analysis", {})

        user_message = DEBRIEF_USER_TEMPLATE.format(
            stakes=state.get("stakes", "(unknown)"),
            counterpart_name=profile.get("name", "the counterpart"),
            transcript_text=_format_transcript(transcript),
            nudges_text=_format_nudges(state.get("nudges_sent", [])),
            prep_text=_format_prep(analysis),
        )

        try:
            response = llm.invoke(
                [
                    SystemMessage(content=DEBRIEF_SYSTEM_PROMPT),
                    HumanMessage(content=user_message),
                ]
            )
            raw = response.content.strip() if response.content else ""
            if raw:
                notes = [line.strip() for line in raw.splitlines() if line.strip()]
            else:
                notes = _build_deterministic_notes(state)
        except Exception:
            notes = _build_deterministic_notes(state)

    return {
        "phase": "debrief",
        "debrief_notes": notes,
    }
