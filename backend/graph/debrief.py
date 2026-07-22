"""Debrief phase owned by Person A."""

from .llm import complete
from .state import ConversationState

_DEBRIEF_SYSTEM = (
    "You are a post-meeting debrief analyst for high-stakes conversations. "
    "From the transcript, produce debrief notes as plain lines, one note per "
    "line, no numbering, in this order:\n"
    "1) One-line outcome summary starting 'OUTCOME: '.\n"
    "2) Every commitment the user made, each starting 'COMMITMENT: ' — "
    "include accidental or soft commitments (phrases like 'we could', "
    "'I'll see what I can do').\n"
    "3) Every counterpart objection left unanswered, each starting 'OPEN: '.\n"
    "4) For each known weak point, one line starting 'WEAK POINT: ' saying "
    "whether it showed up and where.\n"
    "5) One line starting 'FOLLOW-UP EMAIL: ' followed by a short, sendable "
    "draft (use \\n for line breaks inside the draft)."
)


def run_debrief(state: ConversationState) -> dict:
    """Summarize commitments, unanswered objections, and next actions."""
    transcript = state.get("transcript") or []
    if not transcript:
        return {
            "phase": "debrief",
            "debrief_notes": [
                "No transcript captured yet — run a rehearsal or live session first."
            ],
        }

    dialogue = "\n".join(f"{t['speaker']}: {t['text']}" for t in transcript)
    nudges = "; ".join(n["message"] for n in state.get("nudges_sent") or []) or "none"
    weak_points = "; ".join(state.get("user_weak_points") or []) or "none"

    analysis = complete(
        _DEBRIEF_SYSTEM,
        (
            f"Stakes: {state.get('stakes', 'unknown')}\n"
            f"Known weak points: {weak_points}\n"
            f"Wingman nudges during the call: {nudges}\n\n"
            f"Transcript:\n{dialogue}"
        ),
        temperature=0.3,
    )

    if not analysis:
        return {
            "phase": "debrief",
            "debrief_notes": [
                f"OUTCOME: {len(transcript)} turns captured; set OPENAI_API_KEY "
                "for the full analysis.",
            ],
        }

    return {
        "phase": "debrief",
        "debrief_notes": [line.strip() for line in analysis.splitlines() if line.strip()],
    }
