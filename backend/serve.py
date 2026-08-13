"""Standalone AG-UI server for the Mettle LangGraph backend."""

from __future__ import annotations

import os

import uvicorn
from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, Field

from graph.checkpoint import create_checkpointer
from graph.context import extract_brief_from_paste
from graph.graph import build_graph
from server_config import allowed_origins


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


@app.post("/extract-context")
async def extract_context(body: ExtractContextRequest) -> dict:
    """Deterministic paste → draft evidence brief. Approval happens in the UI."""
    return extract_brief_from_paste(
        body.text,
        counterpart_name=body.counterpart_name,
    )


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
