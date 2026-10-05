"""Standalone AG-UI server for the Mettle LangGraph backend.

WebMCP endpoints expose the four conversation phases as stateless,
browser-agent-callable tools. They reuse the same graph functions as
CopilotKit/AG-UI but return plain JSON instead of streaming events.
"""

from __future__ import annotations

import os

import uvicorn
from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv
from pydantic import BaseModel, Field

from context.ingestion import import_from_inbox
from context import agentmail_client, memory, research_client
from graph.checkpoint import create_checkpointer
from graph.coach import run_coach
from graph.context import extract_brief_from_paste
from graph.debrief import run_debrief
from graph.graph import build_graph
from graph.opponent import run_opponent
from graph.scenarios import load_scenario
from graph.state import ConversationState
from graph.wingman_reactive import answer_reactive_query
from research import solari as research
from server_config import allowed_origins

# Load the repo-root .env before anything reads os.environ — without this
# every service (Neon, Exa, AgentMail) silently degrades in local dev.
load_dotenv()

checkpointer, close_checkpointer = create_checkpointer()
graph = build_graph(checkpointer=checkpointer)

app = FastAPI()


@app.on_event("shutdown")
def shutdown_checkpointer() -> None:
    """Close the Postgres connection cleanly when the agent process stops."""
    close_checkpointer()


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


class ExtractContextRequest(BaseModel):
    text: str
    counterpart_name: str = Field(default="Elena Park")


class WebMCPExtractRequest(BaseModel):
    text: str
    counterpart_name: str = Field(default="Elena Park")


class WebMCPStateRequest(BaseModel):
    scenario_id: str = Field(default="lp_renewal")
    transcript: list = Field(default_factory=list)
    nudges_sent: list = Field(default_factory=list)
    coach_analysis: dict | None = Field(default=None)
    context_brief: dict | None = Field(default=None)
    open_reactive_query: str = Field(default="")
    user_weak_points: list = Field(default_factory=list)


@app.post("/extract-context")
async def extract_context(body: ExtractContextRequest) -> dict:
    """Deterministic paste → draft evidence brief. Approval happens in the UI."""
    return extract_brief_from_paste(
        body.text,
        counterpart_name=body.counterpart_name,
    )


class ResearchRequest(BaseModel):
    topic: str
    counterpart_name: str | None = Field(default=None)
    organization: str | None = Field(default=None)


class SolariResearchRequest(BaseModel):
    urls: list[str] = Field(default_factory=list, max_length=research.MAX_URLS)


class MemoRequest(BaseModel):
    to: str
    subject: str = Field(default="Your Mettle debrief")
    notes: list[str] = Field(default_factory=list)


@app.post("/context/import")
async def context_import() -> dict:
    """Pull the agent's own inbox → draft event + evidence brief.

    All claims arrive decision=pending with provenance labels; the HITL
    keep/reject gate decides what reaches Coach. Degrades to the bundled
    seed thread when the inbox is unconfigured — never 500s.
    """
    return import_from_inbox()


@app.post("/context/research")
async def context_research(body: ResearchRequest) -> dict:
    """Scoped Exa research → provenance="web" claims for the same gate."""
    return research_client.research(
        body.topic,
        counterpart_name=body.counterpart_name,
        organization=body.organization,
    )


@app.post("/debrief/memo")
async def debrief_memo(body: MemoRequest) -> dict:
    """Email the debrief memo to the user from the agent's own address."""
    text = "\n".join(f"• {note}" for note in body.notes) or "Debrief complete."
    sent = agentmail_client.send_memo(to=body.to, subject=body.subject, text=text)
    if sent is None:
        return {
            "sent": False,
            "degraded": True,
            "reason": "AGENTMAIL_API_KEY not set or send failed",
        }
    return {"sent": True, **sent}


@app.get("/research/status")
async def research_status() -> dict:
    return {"available": research.is_configured(), "max_urls": research.MAX_URLS}


@app.post("/research")
async def run_research(body: SolariResearchRequest) -> dict:
    """Read user-named public pages in a recorded Solari session → draft brief."""
    if not research.normalize_urls(body.urls):
        raise HTTPException(status_code=422, detail="Add at least one http(s) URL.")
    try:
        return await research.research_public_pages(body.urls)
    except research.ResearchUnavailable as err:
        raise HTTPException(
            status_code=503, detail="Public research is not configured."
        ) from err


@app.get("/research/replay/{session_id}")
async def research_replay(session_id: str) -> Response:
    if not research.valid_session_id(session_id):
        raise HTTPException(status_code=404, detail="Unknown session")
    try:
        replay = await research.fetch_replay(session_id)
    except research.ResearchUnavailable as err:
        raise HTTPException(
            status_code=503, detail="Public research is not configured."
        ) from err
    if replay is None:
        raise HTTPException(status_code=404, detail="Replay not uploaded yet")
    return Response(content=replay, media_type="application/x-ndjson")


def _build_state(req: WebMCPStateRequest) -> ConversationState:
    scenario = load_scenario(req.scenario_id or "lp_renewal")
    state: ConversationState = {
        "scenario_id": scenario["scenario_id"],
        "stakes": scenario["stakes"],
        "counterpart_profile": scenario["counterpart_profile"],
        "user_weak_points": req.user_weak_points
        or scenario.get("user_weak_points", []),
        "transcript": req.transcript,
        "nudges_sent": req.nudges_sent,
        "open_reactive_query": req.open_reactive_query,
        "phase": "prep",
    }
    if req.coach_analysis:
        state["coach_analysis"] = req.coach_analysis  # type: ignore[typeddict-item]
    if req.context_brief:
        state["context_brief"] = req.context_brief  # type: ignore[typeddict-item]
    return state


@app.get("/webmcp/event")
async def webmcp_event(scenario_id: str = "lp_renewal") -> dict:
    """Return a high-stakes conversation scenario the agent can prepare for."""
    return load_scenario(scenario_id)


@app.post("/webmcp/extract")
async def webmcp_extract(body: WebMCPExtractRequest) -> dict:
    """Turn pasted correspondence into a draft evidence brief."""
    return extract_brief_from_paste(body.text, counterpart_name=body.counterpart_name)


@app.post("/webmcp/coach")
async def webmcp_coach(body: WebMCPStateRequest) -> dict:
    """Run the multi-perspective Coach debate and return the synthesis."""
    state = _build_state(body)
    result = run_coach(state)
    return {
        "coach_analysis": result.get("coach_analysis"),
        "coach_stage": result.get("coach_stage"),
        "counterpart_profile": result.get("counterpart_profile"),
        "stakes": result.get("stakes"),
    }


@app.post("/webmcp/opponent")
async def webmcp_opponent(body: WebMCPStateRequest) -> dict:
    """Generate an in-character counterpart response for the last user turn."""
    state = _build_state(body)
    state["phase"] = "rehearsal"  # type: ignore[typeddict-item]
    result = run_opponent(state)
    transcript = result.get("transcript", [])
    return {
        "response": transcript[-1]["text"] if transcript else "",
        "transcript": transcript,
    }


@app.post("/webmcp/wingman")
async def webmcp_wingman(body: WebMCPStateRequest) -> dict:
    """Answer a quick tactical question during a live conversation."""
    state = _build_state(body)
    state["open_reactive_query"] = body.open_reactive_query
    result = answer_reactive_query(state)
    return {"reply": result.get("reactive_reply")}


@app.post("/webmcp/debrief")
async def webmcp_debrief(body: WebMCPStateRequest) -> dict:
    """Summarize commitments, open objections, and next actions."""
    state = _build_state(body)
    state["nudges_sent"] = body.nudges_sent
    result = run_debrief(state)
    return {"notes": result.get("debrief_notes", [])}


# --- Counterpart memory (pinned contract) -----------------------------------
# GET    /memory/{ref} -> { ref, found, degraded?, history? }
# DELETE /memory/{ref} -> { ref, deleted, degraded? }
# Always 200: an unconfigured database is `degraded: true`, never a 500.


@app.get("/memory/{ref}")
async def memory_get(ref: str) -> dict:
    """What the agent remembers about a counterpart (ref = normalized name)."""
    if not memory._database_url():
        return {"ref": ref, "found": False, "degraded": True,
                "reason": "DATABASE_URL not set"}
    history = memory.get_history(ref)
    if history is None:
        return {"ref": memory.counterpart_key(ref), "found": False}
    return {"ref": history["ref"], "found": True, "history": history}


@app.delete("/memory/{ref}")
async def memory_forget(ref: str) -> dict:
    """Forget everything remembered about a counterpart."""
    if not memory._database_url():
        return {"ref": ref, "deleted": 0, "degraded": True,
                "reason": "DATABASE_URL not set"}
    deleted = memory.forget(ref)
    if deleted is None:
        return {"ref": memory.counterpart_key(ref), "deleted": 0, "degraded": True,
                "reason": "memory unavailable"}
    return {"ref": memory.counterpart_key(ref), "deleted": deleted}


add_langgraph_fastapi_endpoint(
    app=app,
    agent=LangGraphAGUIAgent(
        name="conversation_agent",
        description="Mettle high-stakes conversation agent",
        graph=graph,
    ),
    path="/",
)


if __name__ == "__main__":
    port = int(os.getenv("AGENT_PORT", "8123"))
    reload = os.getenv("METTLE_ENV", "development").lower() == "development"
    uvicorn.run(app, host="0.0.0.0", port=port, reload=reload)
