import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from graph.coach import (
    FALLBACK_ANALYSIS,
    FALLBACK_PERSPECTIVES,
    PERSPECTIVE_CONFIG,
    run_coach,
)


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
        for field in (
            "blind_spots",
            "concrete_moves",
            "likely_objections",
            "opening_strategy",
        ):
            self.assertIn(field, analysis)
        self.assertGreaterEqual(len(analysis["blind_spots"]), 1)
        self.assertGreaterEqual(len(analysis["concrete_moves"]), 1)
        self.assertGreaterEqual(len(analysis["likely_objections"]), 1)

    def test_fallback_analysis_is_non_empty(self):
        """The fallback analysis must have substantive content, not empty lists."""
        self.assertGreaterEqual(len(FALLBACK_ANALYSIS["blind_spots"]), 2)
        self.assertGreaterEqual(len(FALLBACK_ANALYSIS["concrete_moves"]), 2)
        self.assertGreaterEqual(len(FALLBACK_ANALYSIS["likely_objections"]), 2)
        self.assertTrue(FALLBACK_ANALYSIS["opening_strategy"].strip())

    def test_fallback_includes_all_three_perspectives(self):
        """The fallback must carry all three adversarial perspectives."""
        names = {p["name"] for p in FALLBACK_PERSPECTIVES}
        self.assertEqual(names, {"skeptic", "counterpart", "negotiator"})
        for p in FALLBACK_PERSPECTIVES:
            self.assertTrue(p["analysis"].strip())

    def test_fallback_analysis_has_perspectives_disagreements_consensus(self):
        """The fallback CoachAnalysis must include the new debate fields."""
        self.assertIn("perspectives", FALLBACK_ANALYSIS)
        self.assertIn("disagreements", FALLBACK_ANALYSIS)
        self.assertIn("consensus", FALLBACK_ANALYSIS)
        self.assertGreaterEqual(len(FALLBACK_ANALYSIS["perspectives"]), 3)
        self.assertGreaterEqual(len(FALLBACK_ANALYSIS["disagreements"]), 1)
        self.assertGreaterEqual(len(FALLBACK_ANALYSIS["consensus"]), 1)

    def test_perspective_config_has_three_adversarial_roles(self):
        """The pipeline must run exactly three named perspectives."""
        names = [name for name, _ in PERSPECTIVE_CONFIG]
        self.assertEqual(names, ["skeptic", "counterpart", "negotiator"])
        self.assertEqual(len(PERSPECTIVE_CONFIG), 3)

    def test_perspective_prompts_are_adversarial(self):
        """Each prompt must have a distinct adversarial stance, not vague 'different views'."""
        _, skeptic_prompt = PERSPECTIVE_CONFIG[0]
        _, counterpart_prompt = PERSPECTIVE_CONFIG[1]
        _, negotiator_prompt = PERSPECTIVE_CONFIG[2]

        # Skeptic must explicitly attack, not help
        self.assertIn("attack", skeptic_prompt.lower())
        self.assertIn("not to help", skeptic_prompt.lower())

        # Counterpart must speak in first person as the actual person
        self.assertIn("{counterpart_name}", counterpart_prompt)
        self.assertIn("first person", counterpart_prompt.lower())

        # Negotiator must reference Voss / tactical empathy
        self.assertIn("voss", negotiator_prompt.lower())
        self.assertIn("tactical empathy", negotiator_prompt.lower())

    def test_synthesis_prompt_requires_surfacing_disagreement(self):
        """The synthesis prompt must explicitly require surfacing disagreements."""
        from graph.coach import SYNTHESIS_PROMPT

        self.assertIn("disagreed", SYNTHESIS_PROMPT.lower())
        self.assertIn("not paper over", SYNTHESIS_PROMPT.lower())
        self.assertIn("disagreements", SYNTHESIS_PROMPT.lower())

    def test_coach_output_includes_perspectives_without_api_key(self):
        """Without an API key, the output must still carry the fallback perspectives."""
        result = run_coach({"scenario_id": "lp_renewal"})
        analysis = result["coach_analysis"]

        self.assertIn("perspectives", analysis)
        self.assertEqual(len(analysis["perspectives"]), 3)
        self.assertIn("disagreements", analysis)
        self.assertIn("consensus", analysis)
