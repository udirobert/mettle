"""Top-level phase router for the high-stakes conversation agent."""

from typing import Literal

from langgraph.graph import END, START, StateGraph
from langgraph.types import Command

from .coach import run_coach
from .debrief import run_debrief
from .opponent import run_opponent
from .state import ConversationState
from .wingman_proactive import evaluate_proactive_nudge
from .wingman_reactive import answer_reactive_query, wait_for_reactive_query


def route_phase(
    state: ConversationState,
) -> Command[Literal["coach", "opponent", "proactive", "reactive_wait", "debrief"]]:
    """Select one phase without duplicating state or graph entrypoints."""
    if state["phase"] == "live":
        destination = (
            "reactive_wait" if state.get("awaiting_reactive_query") else "proactive"
        )
    else:
        destination = {
            "prep": "coach",
            "rehearsal": "opponent",
            "debrief": "debrief",
        }[state["phase"]]
    return Command(goto=destination)


builder = StateGraph(ConversationState)
builder.add_node("phase_router", route_phase)
builder.add_node("coach", run_coach)
builder.add_node("opponent", run_opponent)
builder.add_node("proactive", evaluate_proactive_nudge)
builder.add_node("reactive_wait", wait_for_reactive_query)
builder.add_node("reactive_answer", answer_reactive_query)
builder.add_node("debrief", run_debrief)
builder.add_edge(START, "phase_router")
builder.add_edge("coach", END)
builder.add_edge("opponent", END)
builder.add_edge("proactive", END)
builder.add_edge("reactive_wait", "reactive_answer")
builder.add_edge("reactive_answer", END)
builder.add_edge("debrief", END)


def build_graph(*, checkpointer: object | None = None):
    """Compile for either the LangGraph Platform or an explicit local store.

    The Platform owns checkpoint persistence and rejects graphs that embed a
    custom checkpointer. Local interrupt tests can pass ``MemorySaver()`` here
    when they need to invoke and resume a graph in one process.
    """
    if checkpointer is None:
        return builder.compile()
    return builder.compile(checkpointer=checkpointer)


# Export the Platform-compatible graph used by backend/langgraph.json.
graph = build_graph()
