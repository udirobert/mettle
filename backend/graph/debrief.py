"""Debrief phase.

Post-conversation synthesis: reads the full transcript, nudges sent, and
coach analysis to produce a structured debrief. Surfaces commitments made,
objections left unresolved, and concrete next actions. Falls back to a
deterministic summary when no API key is configured.
"""

from __future__ import annotations

import re

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
- Do not invent commitments or objections that are not in the transcript.
- For commitments, reuse the exact words from the transcript where possible —
  unverifiable commitments are discarded downstream."""

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


# Prompt budget: the tail of a long transcript is what matters for "what was
# just decided" — cap it rather than letting the prompt grow with conversation
# length. Commitment verification reads the full transcript from state, not
# this prompt, so nothing is lost to the check.
_TRANSCRIPT_PROMPT_MAX_CHARS = 6000


def _format_transcript(transcript: list) -> str:
    if not transcript:
        return "(no turns captured)"
    lines = []
    for turn in transcript:
        speaker = (
            "You" if turn["speaker"] == "user" else turn.get("speaker", "Counterpart")
        )
        lines.append(f"  {speaker}: {turn['text']}")
    text = "\n".join(lines)
    if len(text) > _TRANSCRIPT_PROMPT_MAX_CHARS:
        text = "(earlier turns omitted)\n" + text[-_TRANSCRIPT_PROMPT_MAX_CHARS:]
    return text


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


_COMMITMENT_MARKERS = (
    "commit",
    "agreed",
    "promise",
    "will ",
    "by friday",
    "by monday",
    "by tuesday",
    "by wednesday",
    "by thursday",
    "send ",
    "follow up",
    "follow-up",
    "owe",
    "deliver",
    "within 24 hours",
)


_STOPWORDS = frozenset(
    {
        "the",
        "and",
        "for",
        "that",
        "this",
        "with",
        "from",
        "will",
        "have",
        "has",
        "you",
        "your",
        "they",
        "them",
        "what",
        "when",
        "about",
        "into",
        "before",
        "after",
        "would",
        "could",
        "should",
        "there",
        "their",
    }
)
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")


def _content_words(text: str) -> set[str]:
    """Meaningful words used to match a note back to the line that supports it."""
    return {
        word
        for word in re.findall(r"[a-z0-9']+", text.lower())
        if len(word) >= 4 and word not in _STOPWORDS
    }


def _transcript_sentences(transcript: list, counterpart_name: str) -> list[dict]:
    """Verbatim transcript sentences with their speaker label."""
    sentences: list[dict] = []
    for turn in transcript:
        speaker = (
            "You"
            if turn.get("speaker") == "user"
            else counterpart_name or str(turn.get("speaker") or "Counterpart")
        )
        for sentence in _SENTENCE_END.split(str(turn.get("text") or "")):
            text = sentence.strip()
            if text:
                sentences.append({"text": text, "speaker": speaker})
    return sentences


def _commitment_quotes(
    notes: list[str], transcript: list, counterpart_name: str
) -> list[dict]:
    """Match each commitment-shaped note to the verbatim transcript line that
    supports it.

    Fails closed: a commitment with no verbatim line is not returned here and
    is not written to counterpart memory — remembered commitments must be
    provable, not plausible.
    """
    candidates = [
        sentence
        for sentence in _transcript_sentences(transcript, counterpart_name)
        if any(marker in sentence["text"].lower() for marker in _COMMITMENT_MARKERS)
    ]
    verified: list[dict] = []
    for note in notes:
        note_words = _content_words(note)
        best, best_score = None, 0
        for candidate in candidates:
            # A verbatim substring inside the note is a direct match; otherwise
            # require two shared content words so the quote actually supports it.
            score = len(note_words & _content_words(candidate["text"]))
            if candidate["text"].lower() in note.lower():
                score += 100
            if score > best_score:
                best, best_score = candidate, score
        if best is not None and best_score >= 2:
            verified.append(
                {"text": note, "quote": best["text"], "speaker": best["speaker"]}
            )
    return verified


def _split_notes_for_memory(notes: list[str]) -> tuple[list[str], list[str]]:
    """Split debrief notes into (commitments, other notes) for memory.

    Conservative keyword heuristic — only clearly commitment-shaped notes are
    persisted as commitments, so history_to_claims can later surface them as
    "You previously committed…" memory claims.
    """
    commitments = [
        note
        for note in notes
        if any(marker in note.lower() for marker in _COMMITMENT_MARKERS)
    ]
    rest = [note for note in notes if note not in commitments]
    return commitments, rest


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

    llm = get_llm(max_tokens=600)
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

    # Quote-backed commitments: a commitment survives only when a verbatim
    # transcript line supports it. Unverified commitment-shaped notes still
    # appear in debrief_notes, but not as commitments — and never in memory.
    profile = state.get("counterpart_profile", {})
    counterpart_name = str(profile.get("name") or "")
    commitment_notes, other_notes = _split_notes_for_memory(notes)
    verified = _commitment_quotes(commitment_notes, transcript, counterpart_name)
    verified_texts = {item["text"] for item in verified}
    unverified = [note for note in commitment_notes if note not in verified_texts]

    result: dict = {
        "phase": "debrief",
        "debrief_notes": notes,
        "debrief_commitments": verified,
    }

    # Counterpart memory: debrief notes persist so the next conversation with
    # this person starts from history, not zero. No-op without a database.
    if counterpart_name:
        try:
            from context.memory import record_debrief

            ref = record_debrief(
                counterpart_name,
                organization=str(profile.get("organization") or "") or None,
                commitments=[item["text"] for item in verified],
                notes=other_notes + unverified,
                source_event=state.get("conversation_source"),
            )
            if ref:
                result["counterpart_history_ref"] = ref
        except Exception:
            pass

    return result
