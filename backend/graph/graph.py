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
) -> Command[Literal["coach", "opponent", "proactive", "debrief"]]:
    """Select one phase without duplicating state or graph entrypoints."""
    destination = {
        "prep": "coach",
        "rehearsal": "opponent",
        "live": "proactive",
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
builder.add_edge("proactive", "reactive_wait")
builder.add_edge("reactive_wait", "reactive_answer")
builder.add_edge("reactive_answer", END)
builder.add_edge("debrief", END)

# A checkpointer is added when the graph is deployed so LangGraph can resume
# reactive interrupts against the correct conversation thread.
graph = builder.compile()
