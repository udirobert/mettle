import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from graph.coach import FALLBACK_ANALYSIS, run_coach


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

    def test_coach_provides_analysis_without_api_key(self):
        """Without OPENAI_API_KEY, the fallback analysis must still populate."""
        result = run_coach({"scenario_id": "lp_renewal"})

        analysis = result.get("coach_analysis")
        self.assertIsNotNone(analysis)
        self.assertIn("blind_spots", analysis)
        self.assertIn("concrete_moves", analysis)
        self.assertIn("likely_objections", analysis)
        self.assertIn("opening_strategy", analysis)
        self.assertGreaterEqual(len(analysis["blind_spots"]), 1)
        self.assertGreaterEqual(len(analysis["concrete_moves"]), 1)
        self.assertGreaterEqual(len(analysis["likely_objections"]), 1)

    def test_fallback_analysis_is_non_empty(self):
        """The fallback analysis must have substantive content, not empty lists."""
        self.assertGreaterEqual(len(FALLBACK_ANALYSIS["blind_spots"]), 2)
        self.assertGreaterEqual(len(FALLBACK_ANALYSIS["concrete_moves"]), 2)
        self.assertGreaterEqual(len(FALLBACK_ANALYSIS["likely_objections"]), 2)
        self.assertTrue(FALLBACK_ANALYSIS["opening_strategy"].strip())
