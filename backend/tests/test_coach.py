import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from graph.coach import run_coach


class CoachTests(unittest.TestCase):
    def test_lp_renewal_populates_shared_prep_fields(self):
        result = run_coach({"scenario_id": "lp_renewal"})

        self.assertEqual(result["phase"], "prep")
        self.assertIn("$40M", result["stakes"])
        self.assertEqual(result["counterpart_profile"]["name"], "Elena Park")
        self.assertGreaterEqual(len(result["user_weak_points"]), 3)

    def test_coach_retains_user_supplied_weak_points(self):
        result = run_coach(
            {"scenario_id": "lp_renewal", "user_weak_points": ["State the ask first."]}
        )

        self.assertEqual(result["user_weak_points"], ["State the ask first."])
