"""Tests for the Debrief node."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from graph.debrief import (
    FALLBACK_NOTES,
    _build_deterministic_notes,
    _format_nudges,
    _format_prep,
    _format_transcript,
    run_debrief,
)


def user_turn(text: str) -> dict:
    return {"speaker": "user", "text": text, "timestamp": "2026-07-22T10:00:00Z"}


def counterpart_turn(text: str) -> dict:
    return {"speaker": "counterpart", "text": text, "timestamp": "2026-07-22T10:00:01Z"}


LP_STATE = {
    "scenario_id": "lp_renewal",
    "stakes": "$40M LP renewal",
    "counterpart_profile": {
        "name": "Elena Park",
        "role": "CIO, Northstar Foundation",
        "style": ["analytical", "terse", "skeptical"],
        "leverage": "Can renew at a reduced allocation.",
        "concerns": [
            "DPI has lagged the earlier renewal expectation.",
            "Two concentrated positions dominate unrealized value.",
            "The management-fee step-up lacks a clear liquidity case.",
        ],
    },
    "transcript": [
        user_turn("We delivered a 22% net IRR across the portfolio."),
        counterpart_turn("What about liquidity distributions?"),
        user_turn("We expect Q4 distributions to be on track."),
    ],
    "nudges_sent": [
        {
            "id": "test-nudge",
            "kind": "concession",
            "message": "You may have made a commitment. Qualify it before moving on.",
            "timestamp": "2026-07-22T10:00:02Z",
            "source_turn_index": 2,
        }
    ],
    "open_reactive_query": None,
    "phase": "debrief",
    "user_weak_points": [],
    "coach_analysis": {
        "blind_spots": ["Liquidity timeline is the real objection."],
        "likely_objections": ["Why believe the timeline this time?"],
    },
}


class DebriefHelperTests(unittest.TestCase):
    def test_format_transcript_empty(self):
        self.assertEqual(_format_transcript([]), "(no turns captured)")

    def test_format_transcript_includes_speakers(self):
        transcript = [user_turn("Hello"), counterpart_turn("Hi")]
        result = _format_transcript(transcript)
        self.assertIn("You", result)
        self.assertIn("counterpart", result)

    def test_format_nudges_empty(self):
        self.assertEqual(_format_nudges([]), "(none)")

    def test_format_nudges_includes_kind(self):
        nudges = [{"kind": "concession", "message": "Qualify it."}]
        result = _format_nudges(nudges)
        self.assertIn("concession", result)

    def test_format_prep_empty(self):
        self.assertEqual(_format_prep({}), "(no prep notes)")

    def test_format_prep_includes_blind_spots(self):
        analysis = {"blind_spots": ["Liquidity is the real issue"]}
        result = _format_prep(analysis)
        self.assertIn("Liquidity", result)


class DebriefDeterministicTests(unittest.TestCase):
    def test_deterministic_notes_includes_last_counterpart_turn(self):
        notes = _build_deterministic_notes(LP_STATE)
        self.assertTrue(any("Elena Park" in n or "counterpart" in n for n in notes))

    def test_deterministic_notes_flags_concessions(self):
        notes = _build_deterministic_notes(LP_STATE)
        self.assertTrue(any("commitment" in n.lower() for n in notes))

    def test_deterministic_notes_produces_multiple_items(self):
        notes = _build_deterministic_notes(LP_STATE)
        self.assertGreaterEqual(len(notes), 2)

    def test_deterministic_notes_falls_back_when_no_content(self):
        empty_state = {
            **LP_STATE,
            "transcript": [],
            "nudges_sent": [],
            "counterpart_profile": {"name": "Test", "concerns": []},
        }
        notes = _build_deterministic_notes(empty_state)
        self.assertEqual(notes, list(FALLBACK_NOTES))


class DebriefRunTests(unittest.TestCase):
    def test_run_debrief_sets_phase(self):
        result = run_debrief(LP_STATE)
        self.assertEqual(result["phase"], "debrief")

    def test_run_debrief_produces_notes(self):
        result = run_debrief(LP_STATE)
        self.assertIn("debrief_notes", result)
        self.assertGreaterEqual(len(result["debrief_notes"]), 1)

    def test_run_debrief_empty_transcript_gives_guidance(self):
        state = {**LP_STATE, "transcript": []}
        result = run_debrief(state)
        self.assertEqual(result["phase"], "debrief")
        self.assertTrue(
            any("no transcript" in n.lower() for n in result["debrief_notes"])
        )

    def test_run_debrief_notes_are_strings(self):
        result = run_debrief(LP_STATE)
        for note in result["debrief_notes"]:
            self.assertIsInstance(note, str)
            self.assertTrue(note.strip())

    def test_run_debrief_without_api_key_produces_deterministic_notes(self):
        result = run_debrief(LP_STATE)
        self.assertGreaterEqual(len(result["debrief_notes"]), 2)
