"""The pinned /memory contract: always 200, degraded when there is no database."""

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

import serve


class MemoryRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(serve.app)
        self.original_environment = os.environ.copy()
        os.environ.pop("MEMORY_DATABASE_URL", None)
        os.environ.pop("DATABASE_URL", None)

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self.original_environment)

    def test_get_degrades_without_a_database(self) -> None:
        res = self.client.get("/memory/dana-reyes")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["degraded"], True)
        self.assertEqual(res.json()["found"], False)

    def test_delete_degrades_without_a_database(self) -> None:
        res = self.client.delete("/memory/dana-reyes")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["degraded"], True)
        self.assertEqual(res.json()["deleted"], 0)

    def test_get_returns_history_when_known(self) -> None:
        os.environ["DATABASE_URL"] = "postgresql://example"
        history = {
            "ref": "dana-reyes",
            "counterpart_name": "Dana Reyes",
            "commitments": ["Q3 review"],
            "assumptions": [],
            "notes": [],
        }
        with patch.object(serve.memory, "get_history_by_ref", return_value=history):
            body = self.client.get("/memory/Dana Reyes").json()
        self.assertEqual(body["found"], True)
        self.assertEqual(body["history"]["commitments"], ["Q3 review"])

    def test_get_unknown_counterpart_is_found_false_not_degraded(self) -> None:
        os.environ["DATABASE_URL"] = "postgresql://example"
        with patch.object(serve.memory, "get_history_by_ref", return_value=None):
            body = self.client.get("/memory/nobody").json()
        self.assertEqual(body, {"ref": "nobody", "found": False})

    def test_qualified_refs_pass_through_untouched(self) -> None:
        os.environ["DATABASE_URL"] = "postgresql://example"
        with patch.object(serve.memory, "get_history_by_ref", return_value=None) as get:
            body = self.client.get("/memory/dana-whitfield--meridianlabs").json()
        get.assert_called_once_with("dana-whitfield--meridianlabs")
        self.assertEqual(body["ref"], "dana-whitfield--meridianlabs")

    def test_delete_targets_the_exact_qualified_record(self) -> None:
        os.environ["DATABASE_URL"] = "postgresql://example"
        with patch.object(serve.memory, "forget", return_value=2) as forget:
            body = self.client.delete("/memory/dana-whitfield--meridianlabs").json()
        forget.assert_called_once_with("dana-whitfield--meridianlabs")
        self.assertEqual(body, {"ref": "dana-whitfield--meridianlabs", "deleted": 2})

    def test_delete_reports_count_and_unavailable(self) -> None:
        os.environ["DATABASE_URL"] = "postgresql://example"
        with patch.object(serve.memory, "forget", return_value=4):
            self.assertEqual(
                self.client.delete("/memory/dana-reyes").json()["deleted"], 4
            )
        with patch.object(serve.memory, "forget", return_value=None):
            self.assertEqual(
                self.client.delete("/memory/dana-reyes").json()["degraded"], True
            )


if __name__ == "__main__":
    unittest.main()
