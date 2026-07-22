"""Checkpoint backend selection for standalone Mettle deployments."""

from __future__ import annotations

import os
from collections.abc import Callable
from contextlib import AbstractContextManager
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.postgres import PostgresSaver

CheckpointerCleanup = Callable[[], None]


def create_checkpointer() -> tuple[object, CheckpointerCleanup]:
    """Return a durable checkpointer when a Postgres URL is configured.

    LangGraph Platform deployments provide their own persistence. This factory is
    for the standalone FastAPI service used on the VPS. Production must provide
    ``CHECKPOINT_DATABASE_URL`` (or the conventional ``DATABASE_URL``); local
    development intentionally retains an in-memory fallback.
    """
    database_url = os.getenv("CHECKPOINT_DATABASE_URL") or os.getenv("DATABASE_URL")
    environment = os.getenv("METTLE_ENV", "development").lower()

    if not database_url:
        if environment == "production":
            raise RuntimeError(
                "CHECKPOINT_DATABASE_URL is required when METTLE_ENV=production."
            )
        return MemorySaver(), lambda: None

    context: AbstractContextManager[PostgresSaver] = PostgresSaver.from_conn_string(
        database_url
    )
    checkpointer = context.__enter__()
    checkpointer.setup()

    def cleanup() -> None:
        context.__exit__(None, None, None)

    return checkpointer, cleanup
