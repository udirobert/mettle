"""Counterpart memory — what the agent remembers about people across conversations.

Backed by Postgres (Neon) via ``DATABASE_URL`` / ``MEMORY_DATABASE_URL``.
Ingest reads it (``get_history``); debrief writes it (``record_debrief``).

Like the other ``context`` clients, every function degrades to ``None`` / ``[]``
when no database is configured or reachable, so callers never need
to guard and routes never 500.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

logger = logging.getLogger(__name__)


_SCHEMA = """
CREATE TABLE IF NOT EXISTS counterpart_memory (
    id              BIGSERIAL PRIMARY KEY,
    counterpart_key TEXT        NOT NULL,
    counterpart_name TEXT       NOT NULL,
    kind            TEXT        NOT NULL CHECK (kind IN ('commitment','assumption','note')),
    text            TEXT        NOT NULL,
    source_event    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS counterpart_memory_key_idx
    ON counterpart_memory (counterpart_key, created_at DESC);
"""

_schema_ready = False


def _database_url() -> str | None:
    return (
        os.getenv("MEMORY_DATABASE_URL", "").strip()
        or os.getenv("DATABASE_URL", "").strip()
        or None
    )


def counterpart_key(name: str) -> str:
    """Stable lookup key: lowercased, punctuation stripped ("Dana Reyes" → "dana-reyes")."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _connect() -> Any | None:
    """Open a short-lived connection, ensuring the schema exists. None on failure."""
    global _schema_ready
    url = _database_url()
    if not url:
        return None
    try:
        import psycopg

        conn = psycopg.connect(url, autocommit=True, connect_timeout=5)
        if not _schema_ready:
            conn.execute(_SCHEMA)
            _schema_ready = True
        return conn
    except Exception:
        logger.warning("counterpart memory unavailable", exc_info=True)
        return None


def get_history(name: str, limit: int = 20) -> dict | None:
    """Everything remembered about ``name``, newest first within each kind.

    Returns ``None`` when memory is unavailable or nothing is known yet:

        {"ref": "dana-reyes", "counterpart_name": "Dana Reyes",
         "commitments": [...], "assumptions": [...], "notes": [...]}
    """
    key = counterpart_key(name)
    if not key:
        return None
    conn = _connect()
    if conn is None:
        return None
    try:
        with conn:
            rows = conn.execute(
                "SELECT counterpart_name, kind, text FROM counterpart_memory "
                "WHERE counterpart_key = %s ORDER BY created_at DESC LIMIT %s",
                (key, limit),
            ).fetchall()
    except Exception:
        logger.warning("counterpart memory read failed", exc_info=True)
        return None
    finally:
        conn.close()

    if not rows:
        return None
    history: dict = {
        "ref": key,
        "counterpart_name": rows[0][0],
        "commitments": [],
        "assumptions": [],
        "notes": [],
    }
    bucket = {"commitment": "commitments", "assumption": "assumptions", "note": "notes"}
    for _, kind, text in rows:
        history[bucket[kind]].append(text)
    return history


def record_debrief(
    name: str,
    *,
    commitments: list[str] | None = None,
    assumptions: list[str] | None = None,
    notes: list[str] | None = None,
    source_event: str | None = None,
) -> str | None:
    """Persist what a debrief learned about ``name``.

    Returns the counterpart ref (for ``state.counterpart_history_ref``), or
    ``None`` when memory is unavailable or there was nothing to write.
    """
    key = counterpart_key(name)
    entries = [
        (kind, text.strip())
        for kind, items in (
            ("commitment", commitments),
            ("assumption", assumptions),
            ("note", notes),
        )
        for text in (items or [])
        if text and text.strip()
    ]
    if not key or not entries:
        return None
    conn = _connect()
    if conn is None:
        return None
    try:
        with conn:
            with conn.transaction():
                for kind, text in entries:
                    conn.execute(
                        "INSERT INTO counterpart_memory "
                        "(counterpart_key, counterpart_name, kind, text, source_event) "
                        "VALUES (%s, %s, %s, %s, %s)",
                        (key, name.strip(), kind, text, source_event),
                    )
    except Exception:
        logger.warning("counterpart memory write failed", exc_info=True)
        return None
    finally:
        conn.close()
    return key


def history_to_claims(history: dict | None) -> list[dict]:
    """Turn remembered commitments into ``EvidenceClaim``-shaped dicts.

    Lane A merges these into the brief at ingest; they appear with the
    ``memory`` provenance badge and still need the user's keep/reject.
    """
    if not history:
        return []
    ref = history["ref"]
    return [
        {
            "claim": f"You previously committed: {text}",
            "source_ids": [f"memory:{ref}"],
            "confidence": "medium",
            "relevance": "commitment",
            "provenance": "memory",
            "decision": "pending",
        }
        for text in history.get("commitments", [])
    ]
