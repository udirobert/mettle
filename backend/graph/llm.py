"""Shared LLM factory with graceful fallback.

All nodes that need LLM calls should use get_llm() (or get_chat_model() for a
specific temperature) which returns None when no provider key is configured.
Nodes must handle the None case by falling back to deterministic behavior —
the graph must run without an LLM so the wiring can be proven end-to-end
before any model logic.

Provider resolution order: OPENROUTER_API_KEY (OpenAI-compatible endpoint),
then OPENAI_API_KEY.
"""

from __future__ import annotations

import os

from langchain_openai import ChatOpenAI

DEFAULT_MODEL = "gpt-4o"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_DEFAULT_MODEL = "openai/gpt-4o-mini"


def get_chat_model(temperature: float | None = None) -> ChatOpenAI | None:
    """Return a chat model, or None when no provider key is set."""
    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if openrouter_key:
        kwargs: dict = {
            "model": os.environ.get("OPENROUTER_MODEL", OPENROUTER_DEFAULT_MODEL),
            "api_key": openrouter_key,
            "base_url": OPENROUTER_BASE_URL,
        }
        if temperature is not None:
            kwargs["temperature"] = temperature
        return ChatOpenAI(**kwargs)

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None
    model = os.environ.get("OPENAI_MODEL", DEFAULT_MODEL)
    kwargs = {"model": model, "api_key": api_key}
    if temperature is not None:
        kwargs["temperature"] = temperature
    return ChatOpenAI(**kwargs)


def get_llm() -> ChatOpenAI | None:
    """Return a ChatOpenAI instance, or None if no provider key is set."""
    return get_chat_model()


def complete(system: str, user: str, temperature: float = 0.7) -> str | None:
    """One-shot completion. Returns None if no key or the call fails."""
    model = get_chat_model(temperature)
    if model is None:
        return None
    try:
        response = model.invoke([("system", system), ("user", user)])
        return str(response.content).strip()
    except Exception:
        return None
