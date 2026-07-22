"""Tests for the Opponent rehearsal node."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from graph.opponent import (
    FALLBACK_RESPONSE,
    _build_fallback_response,
    _first_name,
    _format_transcript_history,
    run_opponent,
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
            "Operational changes matter more than another market explanation.",
        ],
    },
    "transcript": [user_turn("We delivered a 22% net IRR across the portfolio.")],
    "nudges_sent": [],
    "open_reactive_query": None,
    "phase": "rehearsal",
    "user_weak_points": [],
}


class OpponentHelperTests(unittest.TestCase):
    def test_first_name_extracts_first_token(self):
        self.assertEqual(_first_name("Elena Park"), "Elena")
        self.assertEqual(_first_name("Bob"), "Bob")

    def test_first_name_handles_empty_string(self):
        self.assertEqual(_first_name(""), "the counterpart")

    def test_format_transcript_history_first_turn(self):
        self.assertEqual(_format_transcript_history([]), "(this is the first turn)")

    def test_format_transcript_history_includes_speakers(self):
        history = [
            {"speaker": "user", "text": "Our returns are strong."},
            {"speaker": "counterpart", "text": "Show me liquidity."},
        ]
        result = _format_transcript_history(history)
        self.assertIn("You", result)
        self.assertIn("counterpart", result)

    def test_format_transcript_history_caps_at_max_turns(self):
        turns = [{"speaker": "user", "text": f"Turn {i}"} for i in range(10)]
        result = _format_transcript_history(turns, max_turns=3)
        self.assertIn("Turn 7", result)
        self.assertNotIn("Turn 6", result)


class OpponentFallbackTests(unittest.TestCase):
    def test_fallback_targets_liquidity_when_user_avoids_it(self):
        state = {
            **LP_STATE,
            "transcript": [user_turn("Our returns have been exceptional this cycle.")],
        }
        reply = _build_fallback_response(state)
        self.assertIn("Elena", reply)

    def test_fallback_targets_fees_when_user_mentions_liquidity(self):
        state = {
            **LP_STATE,
            "transcript": [user_turn("Liquidity distributions are on track for Q4.")],
        }
        reply = _build_fallback_response(state)
        self.assertIn("fee", reply.lower())

    def test_fallback_targets_concentration_when_user_covers_fees(self):
        state = {
            **LP_STATE,
            "transcript": [
                user_turn("The fee step-up is fair given the liquidity we delivered.")
            ],
        }
        reply = _build_fallback_response(state)
        self.assertIn("concentrat", reply.lower())

    def test_fallback_returns_generic_when_all_covered(self):
        state = {
            **LP_STATE,
            "transcript": [
                user_turn(
                    "Liquidity is on track, the fee step-up is justified, "
                    "and concentration risk is managed through operational changes."
                )
            ],
        }
        reply = _build_fallback_response(state)
        self.assertEqual(reply, FALLBACK_RESPONSE)

    def test_fallback_returns_your_turn_when_last_is_not_user(self):
        state = {
            **LP_STATE,
            "transcript": [counterpart_turn("What about liquidity?")],
        }
        reply = _build_fallback_response(state)
        self.assertEqual(reply, "Your turn.")


class OpponentRunTests(unittest.TestCase):
    def test_run_opponent_appends_counterpart_turn(self):
        result = run_opponent(LP_STATE)

        self.assertEqual(result["phase"], "rehearsal")
        transcript = result["transcript"]
        self.assertEqual(len(transcript), len(LP_STATE["transcript"]) + 1)
        self.assertEqual(transcript[-1]["speaker"], "counterpart")
        self.assertTrue(transcript[-1]["text"].strip())

    def test_run_opponent_skips_when_no_user_turn(self):
        state = {**LP_STATE, "transcript": []}
        result = run_opponent(state)
        self.assertEqual(result["phase"], "rehearsal")
        self.assertNotIn("transcript", result)

    def test_run_opponent_skips_when_last_turn_is_counterpart(self):
        state = {
            **LP_STATE,
            "transcript": [user_turn("Hello"), counterpart_turn("What about returns?")],
        }
        result = run_opponent(state)
        self.assertEqual(result["phase"], "rehearsal")
        self.assertNotIn("transcript", result)

    def test_run_opponent_produces_non_empty_response_without_api_key(self):
        result = run_opponent(LP_STATE)
        last_turn = result["transcript"][-1]
        self.assertTrue(len(last_turn["text"]) > 10)

    def test_run_opponent_preserves_prior_transcript(self):
        result = run_opponent(LP_STATE)
        self.assertEqual(result["transcript"][0], LP_STATE["transcript"][0])
