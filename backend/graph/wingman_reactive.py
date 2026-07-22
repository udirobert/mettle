"""On-demand Wingman phase owned by Person A."""

from langgraph.types import interrupt

from .state import ConversationState


def wait_for_reactive_query(state: ConversationState) -> dict:
    """Pause until the UI resumes this graph with the user's quick question."""
    query = interrupt(
        {
            "kind": "reactive_query",
            "prompt": "What do you need to say next?",
            "phase": state["phase"],
        }
    )
    return {"open_reactive_query": str(query)}


def answer_reactive_query(state: ConversationState) -> dict:
    """TODO(Person A): replace with a short, context-grounded tactical answer."""
    query = state.get("open_reactive_query") or ""
    return {
        "reactive_reply": (
            "Acknowledge the concern, answer the decision-level question, then pause. "
            f"Prompt received: {query}"
        ),
        "open_reactive_query": None,
        "awaiting_reactive_query": False,
    }
