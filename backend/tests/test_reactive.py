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
    def test_fallback_liquidity_query(self):
        state = {
            **LP_STATE,
            "open_reactive_query": "How do I address liquidity concerns?",
        }
        reply = _build_fallback_reply(state)
        self.assertIn("date", reply.lower())
        self.assertNotEqual(reply, FALLBACK_REPLY)

    def test_fallback_fee_query(self):
        state = {**LP_STATE, "open_reactive_query": "What about the fee step-up?"}
        reply = _build_fallback_reply(state)
        self.assertIn("fee", reply.lower())
        self.assertNotEqual(reply, FALLBACK_REPLY)

    def test_fallback_concentration_query(self):
        state = {
            **LP_STATE,
            "open_reactive_query": "How do I handle concentration risk?",
        }
        reply = _build_fallback_reply(state)
        self.assertIn("concentration", reply.lower())
        self.assertNotEqual(reply, FALLBACK_REPLY)

    def test_fallback_renewal_query(self):
        state = {
            **LP_STATE,
            "open_reactive_query": "Should I ask for the full renewal?",
        }
        reply = _build_fallback_reply(state)
        self.assertIn("renewal", reply.lower())
        self.assertNotEqual(reply, FALLBACK_REPLY)

    def test_fallback_generic_query(self):
        state = {**LP_STATE, "open_reactive_query": "What should I say next?"}
        reply = _build_fallback_reply(state)
        self.assertTrue(reply.strip())

    def test_fallback_empty_query(self):
        state = {**LP_STATE, "open_reactive_query": ""}
        reply = _build_fallback_reply(state)
        self.assertEqual(reply, FALLBACK_REPLY)


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
            "open_reactive_query": "How do I address the liquidity timeline?",
        }
        result = answer_reactive_query(state)
        reply = result["reactive_reply"].lower()
        self.assertTrue(
            "date" in reply or "milestone" in reply or "liquidity" in reply,
            f"Reply should reference liquidity/date/milestone: {result['reactive_reply']}",
        )
