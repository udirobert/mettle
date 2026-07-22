"""Tests for standalone checkpoint backend selection."""

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from graph.checkpoint import create_checkpointer


class CheckpointerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_environment = os.environ.copy()
        os.environ.pop("CHECKPOINT_DATABASE_URL", None)
        os.environ.pop("DATABASE_URL", None)
        os.environ.pop("METTLE_ENV", None)

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self.original_environment)

    def test_local_development_uses_an_in_memory_checkpointer(self) -> None:
        checkpointer, cleanup = create_checkpointer()

        self.assertEqual(checkpointer.__class__.__name__, "InMemorySaver")
        cleanup()

    def test_production_requires_a_postgres_url(self) -> None:
        os.environ["METTLE_ENV"] = "production"

        with self.assertRaisesRegex(RuntimeError, "CHECKPOINT_DATABASE_URL"):
            create_checkpointer()

    @patch("graph.checkpoint.PostgresSaver")
    def test_postgres_url_initializes_schema_and_closes_connection(
        self, mock_saver: MagicMock
    ) -> None:
        os.environ["CHECKPOINT_DATABASE_URL"] = "postgresql://example"
        context = mock_saver.from_conn_string.return_value
        checkpointer = context.__enter__.return_value

        result, cleanup = create_checkpointer()

        self.assertIs(result, checkpointer)
        checkpointer.setup.assert_called_once()
        cleanup()
        context.__exit__.assert_called_once_with(None, None, None)
