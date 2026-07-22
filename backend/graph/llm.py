"""Small LLM helper shared by the Person A phase nodes (coach, opponent, debrief).

Provider resolution order: OPENROUTER_API_KEY (OpenAI-compatible endpoint),
then OPENAI_API_KEY. Every caller must degrade gracefully when neither is
configured so the graph stays runnable for teammates without credentials.
"""

from __future__ import annotations

import os

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_DEFAULT_MODEL = "openai/gpt-4o-mini"


def get_chat_model(temperature: float = 0.7):
    """Return a chat model, or None when no provider key is set."""
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")
    if openrouter_key:
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=os.environ.get("OPENROUTER_MODEL", OPENROUTER_DEFAULT_MODEL),
            temperature=temperature,
            api_key=openrouter_key,
            base_url=OPENROUTER_BASE_URL,
        )
    if os.environ.get("OPENAI_API_KEY"):
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(model="gpt-4o-mini", temperature=temperature)
    return None


def complete(system: str, user: str, temperature: float = 0.7) -> str | None:
    """One-shot completion. Returns None if no key or the call fails."""
    model = get_chat_model(temperature)
    if model is None:
        return None
    try:
        response = model.invoke(
            [("system", system), ("user", user)]
        )
        return str(response.content).strip()
    except Exception:
        return None
