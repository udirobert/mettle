from __future__ import annotations

import unittest

from server_config import allowed_origins


class AllowedOriginsTests(unittest.TestCase):
    def test_development_defaults_to_local_origins(self) -> None:
        self.assertEqual(
            allowed_origins({}),
            ["http://localhost:3000", "http://127.0.0.1:3000"],
        )

    def test_production_requires_explicit_origins(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "CORS_ALLOWED_ORIGINS"):
            allowed_origins({"METTLE_ENV": "production"})

    def test_configured_origins_are_trimmed(self) -> None:
        self.assertEqual(
            allowed_origins(
                {
                    "METTLE_ENV": "production",
                    "CORS_ALLOWED_ORIGINS": " https://mettle.vercel.app, https://demo.mettle.app ",
                }
            ),
            ["https://mettle.vercel.app", "https://demo.mettle.app"],
        )
