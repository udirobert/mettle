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
