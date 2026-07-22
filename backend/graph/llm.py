"""Small LLM helper shared by the Person A phase nodes (coach, opponent, debrief).

Every caller must degrade gracefully when no provider key is configured so the
graph stays runnable for teammates without credentials.
"""

from __future__ import annotations

import os


def get_chat_model(temperature: float = 0.7):
    """Return a ChatOpenAI instance, or None when OPENAI_API_KEY is unset."""
    if not os.environ.get("OPENAI_API_KEY"):
        return None
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(model="gpt-4o-mini", temperature=temperature)


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
