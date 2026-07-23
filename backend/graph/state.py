"""Shared contract for every conversation phase.

Do not create mode-local state schemas. Coach writes context here, and the same
state is consumed by rehearsal, the live Wingman, and debrief.
"""

from __future__ import annotations

from typing import Literal, NotRequired, TypedDict


class TranscriptTurn(TypedDict):
    speaker: Literal["user", "counterpart", "system"]
    text: str
    timestamp: str


class Nudge(TypedDict):
    id: str
    kind: Literal["repetition", "long_monologue", "concession", "timing", "other"]
    message: str
    timestamp: str
    source_turn_index: int


class PerspectiveResult(TypedDict):
    """Raw output from one adversarial perspective in the Coach debate."""

    name: str  # "skeptic", "counterpart", "negotiator"
    analysis: str  # the perspective's full analysis text


class ContextSource(TypedDict):
    source_id: str
    provider: Literal[
        "gmail",
        "calendar",
        "outlook",
        "slack",
        "notion",
        "drive",
        "exa",
        "firecrawl",
        "tinyfish",
        "manual",
    ]
    title: str
    author: str | None
    timestamp: str | None
    url: str | None


class EvidenceClaim(TypedDict):
    claim: str
    source_ids: list[str]
    confidence: Literal["low", "medium", "high"]
    relevance: Literal[
        "stakes",
        "counterpart",
        "objection",
        "commitment",
        "number",
        "timeline",
        "market",
        "company",
        "person",
        "risk",
    ]


class ContextBrief(TypedDict):
    status: Literal["empty", "draft", "approved", "rejected"]
    sources: list[ContextSource]
    claims: list[EvidenceClaim]
    counterpart_history: list[str]
    open_commitments: list[str]
    sensitive_redactions: list[str]
    user_approved_at: str | None


class CoachAnalysis(TypedDict):
    """Structured output from the Coach stress-test.

    Set during prep; the proactive Wingman reads blind_spots and likely_objections
    to calibrate nudge sensitivity during the live conversation.

    The multi-perspective debate runs three adversarial perspectives in parallel
    (Skeptic, Counterpart, Voss Negotiator), then synthesizes them into the
    structured fields below. The raw perspectives and surfaced disagreements
    are preserved so the UI can show the reasoning, not just the conclusion.
    """

    blind_spots: list[str]
    concrete_moves: list[str]
    likely_objections: list[str]
    opening_strategy: str
    perspectives: list[PerspectiveResult]
    disagreements: list[str]
    consensus: list[str]


class ConversationState(TypedDict):
    # Set during Coach and read by all downstream phases.
    scenario_id: str
    stakes: str
    counterpart_profile: dict[str, object]
    user_weak_points: list[str]

    # Live conversation data.
    transcript: list[TranscriptTurn]
    nudges_sent: list[Nudge]
    open_reactive_query: str | None

    # Phase control.
    phase: Literal["prep", "rehearsal", "live", "debrief"]

    # Integration fields. Keep these here rather than inventing a second mode state.
    awaiting_reactive_query: NotRequired[bool]
    reactive_reply: NotRequired[str | None]
    debrief_notes: NotRequired[list[str]]

    # Coach analysis output — set during prep, read by Wingman for sensitivity.
    coach_analysis: NotRequired[CoachAnalysis]

    # Context ingestion — evidence brief from imported sources (Gmail, Calendar, etc.)
    context_brief: NotRequired[ContextBrief]

    # Optional pre-fill text for the reactive Wingman quick-answer prompt.
    reactive_query_prefill: NotRequired[str | None]
