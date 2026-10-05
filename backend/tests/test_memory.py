"""Tests for counterpart memory (Postgres-backed, degrades without a DB)."""

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from context import memory


def _fake_conn(rows=None) -> MagicMock:
    conn = MagicMock()
    conn.__enter__.return_value = conn
    conn.execute.return_value.fetchall.return_value = rows or []
    return conn


class MemoryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_environment = os.environ.copy()
        os.environ.pop("MEMORY_DATABASE_URL", None)
        os.environ.pop("DATABASE_URL", None)
        memory._schema_ready = False

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self.original_environment)

    def test_counterpart_key_normalizes_names(self) -> None:
        self.assertEqual(memory.counterpart_key(" Dana  Reyes! "), "dana-reyes")

    def test_everything_degrades_without_a_database(self) -> None:
        self.assertIsNone(memory.get_history("Dana"))
        self.assertIsNone(memory.record_debrief("Dana", commitments=["a raise"]))
        self.assertEqual(memory.history_to_claims(None), [])

    def test_nothing_to_write_skips_the_database(self) -> None:
        os.environ["DATABASE_URL"] = "postgresql://example"
        with patch("psycopg.connect") as connect:
            self.assertIsNone(memory.record_debrief("Dana", commitments=["  "]))
        connect.assert_not_called()

    def test_connection_failure_degrades(self) -> None:
        os.environ["DATABASE_URL"] = "postgresql://example"
        with patch("psycopg.connect", side_effect=OSError("down")):
            self.assertIsNone(memory.get_history("Dana"))
            self.assertIsNone(memory.record_debrief("Dana", notes=["x"]))

    def test_get_history_groups_rows_by_kind(self) -> None:
        os.environ["DATABASE_URL"] = "postgresql://example"
        conn = _fake_conn(
            [
                ("Dana Reyes", "commitment", "Revisit comp in Q3"),
                ("Dana Reyes", "assumption", "Budget is fixed"),
            ]
        )
        with patch("psycopg.connect", return_value=conn):
            history = memory.get_history("dana reyes")

        self.assertEqual(history["ref"], "dana-reyes")
        self.assertEqual(history["commitments"], ["Revisit comp in Q3"])
        self.assertEqual(history["assumptions"], ["Budget is fixed"])
        conn.close.assert_called_once()

    def test_record_debrief_writes_each_entry_and_returns_ref(self) -> None:
        os.environ["DATABASE_URL"] = "postgresql://example"
        conn = _fake_conn()
        with patch("psycopg.connect", return_value=conn):
            ref = memory.record_debrief(
                "Dana Reyes", commitments=["Q3 review"], assumptions=["Fixed budget"]
            )

        self.assertEqual(ref, "dana-reyes")
        inserts = [c for c in conn.execute.call_args_list if "INSERT" in str(c.args[0])]
        self.assertEqual(len(inserts), 2)

    def test_history_to_claims_builds_memory_claims(self) -> None:
        claims = memory.history_to_claims(
            {"ref": "dana-reyes", "commitments": ["Q3 review"]}
        )

        self.assertEqual(len(claims), 1)
        self.assertEqual(claims[0]["provenance"], "memory")
        self.assertEqual(claims[0]["decision"], "pending")
        self.assertEqual(claims[0]["relevance"], "commitment")


class ForgetTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_environment = os.environ.copy()
        os.environ.pop("MEMORY_DATABASE_URL", None)
        os.environ.pop("DATABASE_URL", None)
        memory._schema_ready = False

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self.original_environment)

    def test_forget_is_none_without_a_database(self) -> None:
        self.assertIsNone(memory.forget("dana-reyes"))

    def test_forget_deletes_by_normalized_key_and_reports_count(self) -> None:
        os.environ["DATABASE_URL"] = "postgresql://example"
        conn = _fake_conn()
        conn.execute.return_value.rowcount = 3
        with patch("psycopg.connect", return_value=conn):
            self.assertEqual(memory.forget("Dana Reyes"), 3)
        delete = [c for c in conn.execute.call_args_list if "DELETE" in str(c.args[0])][
            0
        ]
        self.assertEqual(delete.args[1], ("dana-reyes",))

    def test_forget_zero_is_distinct_from_unavailable(self) -> None:
        os.environ["DATABASE_URL"] = "postgresql://example"
        conn = _fake_conn()
        conn.execute.return_value.rowcount = 0
        with patch("psycopg.connect", return_value=conn):
            self.assertEqual(memory.forget("nobody"), 0)


class IdentityTests(unittest.TestCase):
    """Shared vectors: frontend/src/lib/counterpart-identity.test.ts asserts the
    same table, so the two implementations cannot drift apart."""

    ORGANIZATION_VECTORS = [
        ("Meridian Labs", "meridianlabs"),
        ("Meridian Labs, Inc.", "meridianlabs"),
        ("meridianlabs.com", "meridianlabs"),
        ("mail.meridianlabs.co.uk", "meridianlabs"),
        ("@meridianlabs.com", "meridianlabs"),
        ("dana.whitfield@meridianlabs.com", "meridianlabs"),
        ("dana@gmail.com", ""),
        ("Acme Co", "acme"),
        ("gmail.com", ""),
        ("", ""),
    ]
    KEY_VECTORS = [
        (("Dana Whitfield", None), "dana-whitfield"),
        (("Dana Whitfield", "Meridian Labs"), "dana-whitfield--meridianlabs"),
        (("Dana Whitfield", "dana@gmail.com"), "dana-whitfield"),
        (("Dana Whitfield", "meridianlabs.com"), "dana-whitfield--meridianlabs"),
        ((" Dana  Reyes! ", "Reyes & Co"), "dana-reyes--reyes"),
    ]

    def test_organization_key_vectors(self) -> None:
        for raw, expected in self.ORGANIZATION_VECTORS:
            self.assertEqual(memory.organization_key(raw), expected, raw)
        self.assertEqual(memory.organization_key(None), "")

    def test_counterpart_key_vectors(self) -> None:
        for (name, org), expected in self.KEY_VECTORS:
            self.assertEqual(memory.counterpart_key(name, org), expected, (name, org))

    def test_company_name_and_email_domain_identify_the_same_place(self) -> None:
        self.assertEqual(
            memory.counterpart_key("Dana Whitfield", "Meridian Labs"),
            memory.counterpart_key("Dana Whitfield", "meridianlabs.com"),
        )

    def test_two_people_with_one_name_get_different_keys(self) -> None:
        self.assertNotEqual(
            memory.counterpart_key("Dana Whitfield", "meridianlabs.com"),
            memory.counterpart_key("Dana Whitfield", "acme.io"),
        )

    def test_resolve_key_accepts_keys_and_display_names(self) -> None:
        self.assertEqual(
            memory.resolve_key("dana-whitfield--meridianlabs"),
            "dana-whitfield--meridianlabs",
        )
        self.assertEqual(memory.resolve_key("dana-whitfield"), "dana-whitfield")
        self.assertEqual(memory.resolve_key("Dana Whitfield"), "dana-whitfield")


class OrganizationLookupTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_environment = os.environ.copy()
        os.environ["DATABASE_URL"] = "postgresql://example"
        memory._schema_ready = False

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self.original_environment)

    def _stored(self, mapping):
        """Patch _history_for_key with a dict of key -> history."""
        return patch.object(
            memory,
            "_history_for_key",
            side_effect=lambda key, limit=20: mapping.get(key),
        )

    def test_qualified_record_is_an_exact_match(self) -> None:
        rec = {
            "ref": "dana-whitfield--meridianlabs",
            "commitments": ["a"],
            "assumptions": [],
            "notes": [],
        }
        with self._stored({"dana-whitfield--meridianlabs": rec}):
            got = memory.get_history("Dana Whitfield", organization="meridianlabs.com")
        self.assertEqual(got["match"], "exact")
        self.assertEqual(got["ref"], "dana-whitfield--meridianlabs")

    def test_a_different_organization_does_not_see_the_other_persons_record(
        self,
    ) -> None:
        rec = {
            "ref": "dana-whitfield--meridianlabs",
            "commitments": ["a"],
            "assumptions": [],
            "notes": [],
        }
        with self._stored({"dana-whitfield--meridianlabs": rec}):
            self.assertIsNone(
                memory.get_history("Dana Whitfield", organization="acme.io")
            )

    def test_legacy_name_only_record_is_returned_but_marked_unconfirmed(self) -> None:
        legacy = {
            "ref": "dana-whitfield",
            "commitments": ["old"],
            "assumptions": [],
            "notes": [],
        }
        with self._stored({"dana-whitfield": legacy}):
            got = memory.get_history("Dana Whitfield", organization="meridianlabs.com")
        self.assertEqual(got["match"], "name_only")
        claims = memory.history_to_claims(got)
        self.assertIn("matched by name only", claims[0]["claim"])

    def test_exact_match_claims_carry_no_caveat(self) -> None:
        rec = {
            "ref": "k",
            "commitments": ["a"],
            "assumptions": [],
            "notes": [],
            "match": "exact",
        }
        self.assertNotIn("name only", memory.history_to_claims(rec)[0]["claim"])

    def test_record_debrief_writes_under_the_qualified_key(self) -> None:
        conn = _fake_conn()
        with patch("psycopg.connect", return_value=conn):
            ref = memory.record_debrief(
                "Dana Whitfield", notes=["x"], organization="Meridian Labs"
            )
        self.assertEqual(ref, "dana-whitfield--meridianlabs")
        insert = [c for c in conn.execute.call_args_list if "INSERT" in str(c.args[0])][
            0
        ]
        self.assertEqual(insert.args[1][0], "dana-whitfield--meridianlabs")

    def test_forget_deletes_the_exact_qualified_key(self) -> None:
        conn = _fake_conn()
        conn.execute.return_value.rowcount = 1
        with patch("psycopg.connect", return_value=conn):
            self.assertEqual(memory.forget("dana-whitfield--meridianlabs"), 1)
        delete = [c for c in conn.execute.call_args_list if "DELETE" in str(c.args[0])][
            0
        ]
        self.assertEqual(delete.args[1], ("dana-whitfield--meridianlabs",))
