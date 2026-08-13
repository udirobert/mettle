import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from graph.context import (
    SAMPLE_ELENA_THREAD,
    extract_brief_from_paste,
    format_evidence_for_coach,
)
from graph.coach import FALLBACK_ANALYSIS, run_coach


class ExtractContextTests(unittest.TestCase):
    def test_empty_paste_returns_draft_without_claims(self):
        brief = extract_brief_from_paste("   ")
        self.assertEqual(brief["status"], "draft")
        self.assertEqual(brief["claims"], [])
        self.assertIsNone(brief["user_approved_at"])

    def test_sample_thread_extracts_money_dpi_and_memo(self):
        brief = extract_brief_from_paste(SAMPLE_ELENA_THREAD)
        self.assertGreaterEqual(len(brief["sources"]), 2)
        self.assertEqual(brief["sources"][0]["provider"], "manual")
        self.assertEqual(brief["sources"][0]["author"], "Elena Park")

        blob = " ".join(claim["claim"] for claim in brief["claims"])
        self.assertIn("$40M", blob)
        self.assertRegex(blob, r"DPI")
        self.assertRegex(blob.lower(), r"memo")

        relevances = {claim["relevance"] for claim in brief["claims"]}
        self.assertTrue({"number", "objection", "commitment"} & relevances)
        self.assertGreaterEqual(len(brief["open_commitments"]), 1)

    def test_unapproved_brief_is_not_coach_ground_truth(self):
        draft = extract_brief_from_paste(SAMPLE_ELENA_THREAD)
        self.assertIn("Do not invent", format_evidence_for_coach(draft))

        draft["status"] = "approved"
        for claim in draft["claims"]:
            claim["decision"] = "approved"
        rendered = format_evidence_for_coach(draft)
        self.assertIn("Approved evidence", rendered)
        self.assertIn("$40M", rendered)

    def test_rejected_and_pending_claims_are_excluded(self):
        brief = extract_brief_from_paste(SAMPLE_ELENA_THREAD)
        brief["status"] = "approved"
        brief["claims"][0]["decision"] = "approved"
        for claim in brief["claims"][1:]:
            claim["decision"] = "rejected"
        rendered = format_evidence_for_coach(brief)
        self.assertIn(brief["claims"][0]["claim"], rendered)
        if len(brief["claims"]) > 1:
            self.assertNotIn(brief["claims"][1]["claim"], rendered)

    def test_extracted_claims_start_pending(self):
        brief = extract_brief_from_paste(SAMPLE_ELENA_THREAD)
        self.assertTrue(brief["claims"])
        self.assertTrue(all(c.get("decision") == "pending" for c in brief["claims"]))


class CoachEvidenceTests(unittest.TestCase):
    def test_approved_paste_grounds_fallback_analysis(self):
        brief = extract_brief_from_paste(SAMPLE_ELENA_THREAD)
        brief["status"] = "approved"
        for claim in brief["claims"]:
            claim["decision"] = "approved"
        result = run_coach({"scenario_id": "lp_renewal", "context_brief": brief})
        analysis = result["coach_analysis"]
        self.assertEqual(result.get("coach_stage"), "ready")
        self.assertTrue(
            any("thread shows" in spot.lower() for spot in analysis["blind_spots"])
        )
        self.assertNotEqual(
            analysis["blind_spots"][0], FALLBACK_ANALYSIS["blind_spots"][0]
        )
