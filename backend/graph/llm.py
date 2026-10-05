"""Shared LLM factory with graceful fallback.

All nodes that need LLM calls should use get_llm() which returns None
when no API key is configured. Nodes must handle the None case by
falling back to deterministic behavior — the graph must run without
an LLM so the wiring can be proven end-to-end before any model logic.
"""

from __future__ import annotations

import os

from langchain_openai import ChatOpenAI

DEFAULT_MODEL = "gpt-4o"


def get_llm(max_tokens: int | None = None) -> ChatOpenAI | None:
    """Return an OpenAI-compatible chat model, or None if no key is set.

    Callers should pass a ``max_tokens`` budget sized to the response they
    actually need — uncapped completions are the main spend risk on a
    public demo endpoint.
    """
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None

    model = os.environ.get("OPENAI_MODEL", DEFAULT_MODEL)
    base_url = os.environ.get("OPENAI_BASE_URL", "").strip() or None
    return ChatOpenAI(
        model=model, api_key=api_key, base_url=base_url, max_tokens=max_tokens
    )
