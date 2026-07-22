from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from graph.llm import get_llm


class LlmFactoryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_environment = os.environ.copy()
        for key in ("OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_BASE_URL"):
            os.environ.pop(key, None)

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self.original_environment)

    def test_returns_none_without_api_key(self) -> None:
        self.assertIsNone(get_llm())

    @patch("graph.llm.ChatOpenAI")
    def test_passes_openai_compatible_base_url(self, chat_model) -> None:
        os.environ["OPENAI_API_KEY"] = "test-key"
        os.environ["OPENAI_MODEL"] = "provider-model"
        os.environ["OPENAI_BASE_URL"] = "https://provider.example/v1"

        get_llm()

        chat_model.assert_called_once_with(
            model="provider-model",
            api_key="test-key",
            base_url="https://provider.example/v1",
        )
