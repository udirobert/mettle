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
