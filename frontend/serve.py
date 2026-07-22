"""
Thin wrapper to serve the LangGraph agent via AG-UI protocol.
Used in Docker where langgraph-cli dev (which needs Docker) is unavailable.
The original main.py and all backend code remain unmodified.
"""

import os
import sys

# Add the backend directory to the path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

import uvicorn
from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Standalone deployments own their durable checkpointer. The LangGraph Platform
# graph export intentionally leaves persistence to the platform itself.
from graph.checkpoint import create_checkpointer
from graph.graph import build_graph

checkpointer, close_checkpointer = create_checkpointer()
graph = build_graph(checkpointer=checkpointer)

app = FastAPI()


@app.on_event("shutdown")
def shutdown_checkpointer() -> None:
    """Close the Postgres connection cleanly when the agent process stops."""
    close_checkpointer()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
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
