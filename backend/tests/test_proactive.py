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
        nudge = evaluate_latest_turn({"transcript": [user_turn("We can accept a $25M renewal.")], "nudges_sent": []})

        self.assertIsNotNone(nudge)
        self.assertEqual(nudge["kind"], "concession")

    def test_long_monologue_is_flagged(self):
        nudge = evaluate_latest_turn({"transcript": [user_turn("word " * 86)], "nudges_sent": []})

        self.assertIsNotNone(nudge)
        self.assertEqual(nudge["kind"], "long_monologue")

    def test_ingestion_appends_once_and_rate_limits_duplicate(self):
        state = {"transcript": [], "nudges_sent": []}
        first = ingest_transcript_turn(state, speaker="user", text="We can accept a $25M renewal.")
        second = ingest_transcript_turn(first, speaker="user", text="We can accept a $25M renewal.")

        self.assertEqual(len(first["transcript"]), 1)
        self.assertEqual(len(first["nudges_sent"]), 1)
        self.assertEqual(len(second["nudges_sent"]), 1)
