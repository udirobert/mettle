import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from graph.wingman_proactive import ingest_transcript_turn
from triggers.rules import evaluate_latest_turn


def user_turn(text: str) -> dict:
    return {"speaker": "user", "text": text, "timestamp": "2026-07-22T10:00:00Z"}


class ProactiveRuleTests(unittest.TestCase):
    def test_concession_is_flagged(self):
        nudge = evaluate_latest_turn(
            {
                "transcript": [user_turn("We can accept a $25M renewal.")],
                "nudges_sent": [],
            }
        )

        self.assertIsNotNone(nudge)
        self.assertEqual(nudge["kind"], "concession")

    def test_long_monologue_is_flagged(self):
        nudge = evaluate_latest_turn(
            {"transcript": [user_turn("word " * 86)], "nudges_sent": []}
        )

        self.assertIsNotNone(nudge)
        self.assertEqual(nudge["kind"], "long_monologue")

    def test_ingestion_appends_once_and_rate_limits_duplicate(self):
        state = {"transcript": [], "nudges_sent": []}
        first = ingest_transcript_turn(
            state, speaker="user", text="We can accept a $25M renewal."
        )
        second = ingest_transcript_turn(
            first, speaker="user", text="We can accept a $25M renewal."
        )

        self.assertEqual(len(first["transcript"]), 1)
        self.assertEqual(len(first["nudges_sent"]), 1)
        self.assertEqual(len(second["nudges_sent"]), 1)

    def test_nudge_falls_back_to_rules_message_without_api_key(self):
        """Without OPENAI_API_KEY, the nudge message must be the rules-based one."""
        state = {"transcript": [], "nudges_sent": [], "stakes": "test"}
        result = ingest_transcript_turn(
            state, speaker="user", text="We can accept a reduced allocation."
        )

        nudge = result["nudges_sent"][0]
        self.assertIn("commitment", nudge["message"].lower())
        self.assertIn("qualify", nudge["message"].lower())

    def test_enrichment_uses_coach_analysis_when_available(self):
        """The enrichment path must not crash when coach_analysis is populated."""
        state = {
            "transcript": [],
            "nudges_sent": [],
            "stakes": "$40M renewal",
            "counterpart_profile": {
                "name": "Elena Park",
                "concerns": ["DPI lagging", "liquidity timeline"],
            },
            "coach_analysis": {
                "blind_spots": ["Liquidity is the real issue, not DPI"],
                "concrete_moves": ["Name the ask first"],
                "likely_objections": ["Why believe the timeline now?"],
                "opening_strategy": "Lead with operational change",
            },
        }
        result = ingest_transcript_turn(
            state, speaker="user", text="We can accept a $25M renewal."
        )

        self.assertEqual(len(result["nudges_sent"]), 1)
        self.assertTrue(result["nudges_sent"][0]["message"])

    def test_empty_text_produces_no_update(self):
        state = {"transcript": [], "nudges_sent": []}
        result = ingest_transcript_turn(state, speaker="user", text="   ")

        self.assertEqual(result, {})

    def test_counterpart_turn_produces_no_nudge(self):
        state = {"transcript": [], "nudges_sent": []}
        result = ingest_transcript_turn(
            state, speaker="counterpart", text="Why should we believe you this time?"
        )

        self.assertEqual(len(result.get("nudges_sent", [])), 0)
        self.assertEqual(len(result["transcript"]), 1)
