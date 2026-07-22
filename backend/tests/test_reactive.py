"""Tests for the reactive Wingman answer node."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from graph.wingman_reactive import (
    FALLBACK_REPLY,
    _build_fallback_reply,
    _format_transcript_context,
    answer_reactive_query,
)


def user_turn(text: str) -> dict:
    return {"speaker": "user", "text": text, "timestamp": "2026-07-22T10:00:00Z"}


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
            "Operational changes matter more than another market explanation.",
        ],
    },
    "transcript": [
        user_turn("We delivered a 22% net IRR across the portfolio."),
        {
            "speaker": "counterpart",
            "text": "Show me liquidity.",
            "timestamp": "2026-07-22T10:00:01Z",
        },
    ],
    "nudges_sent": [],
    "open_reactive_query": "How do I answer the liquidity question?",
    "phase": "live",
    "user_weak_points": [],
    "awaiting_reactive_query": True,
}


class ReactiveHelperTests(unittest.TestCase):
    def test_format_transcript_context_no_turns(self):
        self.assertEqual(_format_transcript_context([]), "(no turns yet)")

    def test_format_transcript_context_includes_speakers(self):
        transcript = [
            {"speaker": "user", "text": "Our returns are strong."},
            {"speaker": "counterpart", "text": "What about liquidity?"},
        ]
        result = _format_transcript_context(transcript)
        self.assertIn("You", result)
        self.assertIn("counterpart", result)

    def test_format_transcript_context_caps_at_max_turns(self):
        turns = [{"speaker": "user", "text": f"Turn {i}"} for i in range(8)]
        result = _format_transcript_context(turns, max_turns=3)
        self.assertIn("Turn 5", result)
        self.assertNotIn("Turn 4", result)


class ReactiveFallbackTests(unittest.TestCase):
    def test_fallback_matches_concern_keyword(self):
        state = {
            **LP_STATE,
            "open_reactive_query": "How do I address the DPI lag concern?",
        }
        reply = _build_fallback_reply(state)
        self.assertIn("dpi", reply.lower())
        self.assertNotEqual(reply, FALLBACK_REPLY)

    def test_fallback_matches_fee_concern(self):
        state = {
            **LP_STATE,
            "open_reactive_query": "What about the management fee issue?",
        }
        reply = _build_fallback_reply(state)
        self.assertIn("management", reply.lower())
        self.assertNotEqual(reply, FALLBACK_REPLY)

    def test_fallback_matches_concentration_concern(self):
        state = {
            **LP_STATE,
            "open_reactive_query": "How do I handle the concentrated positions risk?",
        }
        reply = _build_fallback_reply(state)
        self.assertIn("concentrated", reply.lower())
        self.assertNotEqual(reply, FALLBACK_REPLY)

    def test_fallback_generic_when_no_concern_matches(self):
        state = {**LP_STATE, "open_reactive_query": "What should I say next?"}
        reply = _build_fallback_reply(state)
        # Generic response that references the counterpart
        self.assertIn("acknowledge", reply.lower())
        self.assertIn("elena", reply.lower())

    def test_fallback_empty_query(self):
        state = {**LP_STATE, "open_reactive_query": ""}
        reply = _build_fallback_reply(state)
        self.assertEqual(reply, FALLBACK_REPLY)

    def test_fallback_uses_first_name(self):
        state = {**LP_STATE, "open_reactive_query": "How do I respond?"}
        reply = _build_fallback_reply(state)
        self.assertIn("elena", reply.lower())


class ReactiveAnswerTests(unittest.TestCase):
    def test_answer_clears_query_and_awaiting_flag(self):
        result = answer_reactive_query(LP_STATE)
        self.assertIsNone(result.get("open_reactive_query"))
        self.assertFalse(result.get("awaiting_reactive_query"))

    def test_answer_produces_non_empty_reply_without_api_key(self):
        result = answer_reactive_query(LP_STATE)
        self.assertTrue(result["reactive_reply"].strip())
        self.assertGreater(len(result["reactive_reply"]), 10)

    def test_answer_with_empty_query_still_produces_reply(self):
        state = {**LP_STATE, "open_reactive_query": ""}
        result = answer_reactive_query(state)
        self.assertTrue(result["reactive_reply"].strip())

    def test_answer_references_query_content(self):
        state = {
            **LP_STATE,
            "open_reactive_query": "How do I address the DPI lag concern?",
        }
        result = answer_reactive_query(state)
        reply = result["reactive_reply"].lower()
        self.assertTrue(
            "dpi" in reply or "lag" in reply or "directly" in reply,
            f"Reply should reference DPI/lag/directly: {result['reactive_reply']}",
        )

    def test_answer_references_fee_concern(self):
        state = {
            **LP_STATE,
            "open_reactive_query": "What about the management fee issue?",
        }
        result = answer_reactive_query(state)
        reply = result["reactive_reply"].lower()
        self.assertIn("management", reply)

    def test_answer_references_concentration_concern(self):
        state = {
            **LP_STATE,
            "open_reactive_query": "How do I handle the concentrated positions risk?",
        }
        result = answer_reactive_query(state)
        reply = result["reactive_reply"].lower()
        self.assertTrue(
            "concentrated" in reply or "positions" in reply,
            f"Reply should reference concentrated/positions: {result['reactive_reply']}",
        )
