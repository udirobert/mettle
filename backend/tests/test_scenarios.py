"""Tests for scenario loading and parsing."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from graph.scenarios import (
    _parse_counterpart_profile,
    _parse_frontmatter,
    list_scenarios,
    load_scenario,
)


class FrontmatterParserTests(unittest.TestCase):
    def test_parse_simple_frontmatter(self):
        content = """---
stakes: "$40M LP renewal"
counterpart_name: Elena Park
---

# Scenario title
"""
        result = _parse_frontmatter(content)
        self.assertEqual(result["stakes"], "$40M LP renewal")
        self.assertEqual(result["counterpart_name"], "Elena Park")

    def test_parse_list_fields(self):
        content = """---
counterpart_concerns:
  - DPI has lagged
  - Two concentrated positions
  - Fee step-up
user_weak_points:
  - May defend returns
  - May over-explain
---

Content here.
"""
        result = _parse_frontmatter(content)
        self.assertEqual(len(result["counterpart_concerns"]), 3)
        self.assertIn("DPI has lagged", result["counterpart_concerns"])
        self.assertEqual(len(result["user_weak_points"]), 2)

    def test_parse_comma_separated_style(self):
        content = """---
counterpart_style: analytical, terse, skeptical
---
"""
        result = _parse_frontmatter(content)
        self.assertEqual(result["counterpart_style"], "analytical, terse, skeptical")

    def test_parse_empty_frontmatter(self):
        content = """# Just a title

No frontmatter here.
"""
        result = _parse_frontmatter(content)
        self.assertEqual(result, {})


class CounterpartProfileTests(unittest.TestCase):
    def test_parse_full_profile(self):
        frontmatter = {
            "counterpart_name": "Elena Park",
            "counterpart_role": "CIO, Northstar Foundation",
            "counterpart_style": "analytical, terse, skeptical",
            "counterpart_leverage": "Can renew at reduced allocation.",
            "counterpart_concerns": [
                "DPI has lagged",
                "Two concentrated positions",
                "Fee step-up",
            ],
        }
        profile = _parse_counterpart_profile(frontmatter)
        self.assertEqual(profile["name"], "Elena Park")
        self.assertEqual(profile["role"], "CIO, Northstar Foundation")
        self.assertEqual(profile["style"], ["analytical", "terse", "skeptical"])
        self.assertEqual(profile["leverage"], "Can renew at reduced allocation.")
        self.assertEqual(len(profile["concerns"]), 3)

    def test_parse_profile_with_defaults(self):
        frontmatter = {}
        profile = _parse_counterpart_profile(frontmatter)
        self.assertEqual(profile["name"], "The counterpart")
        self.assertEqual(profile["role"], "")
        self.assertEqual(profile["style"], [])
        self.assertEqual(profile["leverage"], "")
        self.assertEqual(profile["concerns"], [])


class ScenarioLoadingTests(unittest.TestCase):
    def test_load_lp_renewal(self):
        result = load_scenario("lp_renewal")
        self.assertEqual(result["scenario_id"], "lp_renewal")
        self.assertIn("$40M", result["stakes"])
        self.assertEqual(result["counterpart_profile"]["name"], "Elena Park")
        self.assertGreaterEqual(len(result["user_weak_points"]), 3)

    def test_load_performance_review(self):
        result = load_scenario("performance_review")
        self.assertEqual(result["scenario_id"], "performance_review")
        self.assertIn("terminat", result["stakes"].lower())
        self.assertEqual(result["counterpart_profile"]["name"], "Marcus Chen")
        self.assertGreaterEqual(len(result["counterpart_profile"]["concerns"]), 3)

    def test_load_board_update(self):
        result = load_scenario("board_update")
        self.assertEqual(result["scenario_id"], "board_update")
        self.assertIn("board", result["stakes"].lower())
        self.assertEqual(result["counterpart_profile"]["name"], "Victoria Sterling")

    def test_load_salary_negotiation(self):
        result = load_scenario("salary_negotiation")
        self.assertEqual(result["scenario_id"], "salary_negotiation")
        self.assertIn("compensation", result["stakes"].lower())
        self.assertEqual(result["counterpart_profile"]["name"], "Sarah Martinez")

    def test_load_nonexistent_raises(self):
        with self.assertRaises(FileNotFoundError):
            load_scenario("nonexistent_scenario")


class ListScenariosTests(unittest.TestCase):
    def test_list_returns_all_scenarios(self):
        scenarios = list_scenarios()
        ids = [s["id"] for s in scenarios]
        self.assertIn("lp_renewal", ids)
        self.assertIn("performance_review", ids)
        self.assertIn("board_update", ids)
        self.assertIn("salary_negotiation", ids)

    def test_list_includes_metadata(self):
        scenarios = list_scenarios()
        for scenario in scenarios:
            self.assertIn("id", scenario)
            self.assertIn("name", scenario)
            self.assertIn("stakes", scenario)
            self.assertTrue(scenario["name"])
            self.assertTrue(scenario["stakes"])
