"""Standalone AG-UI server for the Mettle LangGraph backend."""

from __future__ import annotations

import os

import uvicorn
from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from graph.checkpoint import create_checkpointer
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
    uvicorn.run(app, host="0.0.0.0", port=port)
