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


# --- Identity -----------------------------------------------------------------
# A counterpart is a name *plus* an organisation, so two different "Dana"s do not
# share a history. The key is "<name-slug>" (legacy, organisation unknown) or
# "<name-slug>--<org>" where <org> has no separators. Keep in step with
# frontend/src/lib/counterpart-identity.ts — both are tested against one table.

_FREE_MAIL = {
    "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
    "msn.com", "yahoo.com", "icloud.com", "me.com", "aol.com", "proton.me",
    "protonmail.com", "gmx.com", "fastmail.com", "hey.com",
}  # fmt: skip
_LEGAL_SUFFIXES = {
    "inc", "llc", "ltd", "corp", "corporation", "co", "company", "limited",
    "gmbh", "plc", "sa", "ag", "bv", "pty",
}  # fmt: skip
_SECOND_LEVEL = {"co", "com", "org", "net", "ac", "gov", "edu"}
_DOMAIN_RE = re.compile(r"^[a-z0-9-]+(?:\.[a-z0-9-]+)+$")
_KEY_RE = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?")


def organization_key(organization: str | None) -> str:
    """Normalise an organisation name *or* an email domain to one token.

    "Meridian Labs, Inc." and "meridianlabs.com" both become "meridianlabs", so
    a scenario's company name and an email's domain identify the same place.
    Free-mail domains identify nobody and give "".
    """
    text = (organization or "").strip().lower()
    if "@" in text:  # an email address, or "@domain": identity is the domain
        text = text.rsplit("@", 1)[1].strip()
    if not text:
        return ""
    if _DOMAIN_RE.match(text):
        if text in _FREE_MAIL:
            return ""
        labels = text.split(".")[:-1]  # drop the TLD
        if len(labels) >= 2 and labels[-1] in _SECOND_LEVEL:
            labels = labels[:-1]  # meridianlabs.co.uk -> meridianlabs
        return re.sub(r"[^a-z0-9]", "", labels[-1]) if labels else ""
    tokens = re.findall(r"[a-z0-9]+", text)
    while len(tokens) > 1 and tokens[-1] in _LEGAL_SUFFIXES:
        tokens.pop()
    return "".join(tokens)


def counterpart_key(name: str, organization: str | None = None) -> str:
    """Stable lookup key. "Dana Reyes" -> "dana-reyes"; with an organisation
    "Dana Reyes", "Meridian Labs" -> "dana-reyes--meridianlabs"."""
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    org = organization_key(organization)
    return f"{base}--{org}" if base and org else base


def resolve_key(ref: str) -> str:
    """Accept either an existing key or a display name and return the key."""
    text = ref.strip().lower()
    return text if _KEY_RE.fullmatch(text) else counterpart_key(ref)


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


def _history_for_key(key: str, limit: int = 20) -> dict | None:
    """Rows stored under exactly ``key``, grouped by kind. ``None`` when memory is
    unavailable or nothing is stored:

        {"ref": "dana-reyes--meridianlabs", "counterpart_name": "Dana Reyes",
         "commitments": [...], "assumptions": [...], "notes": [...]}
    """
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


def get_history_by_ref(ref: str, limit: int = 20) -> dict | None:
    """Exactly what is stored under ``ref`` (a key or a display name). No
    fallback — this backs the /memory routes, which show one specific record."""
    return _history_for_key(resolve_key(ref), limit)


def get_history(
    name: str, limit: int = 20, organization: str | None = None
) -> dict | None:
    """What is remembered about this counterpart, for use at ingest.

    With an organisation, the organisation-qualified record wins and is marked
    ``match: "exact"``. If only an older name-only record exists it is returned
    marked ``match: "name_only"`` so callers can say it is unconfirmed. Without
    an organisation only the name-only record can be consulted.
    """
    if organization_key(organization):
        exact = _history_for_key(counterpart_key(name, organization), limit)
        if exact:
            return {**exact, "match": "exact"}
    legacy = _history_for_key(counterpart_key(name), limit)
    return {**legacy, "match": "name_only"} if legacy else None


def record_debrief(
    name: str,
    *,
    commitments: list[str] | None = None,
    assumptions: list[str] | None = None,
    notes: list[str] | None = None,
    source_event: str | None = None,
    organization: str | None = None,
) -> str | None:
    """Persist what a debrief learned about ``name``.

    Returns the counterpart ref (for ``state.counterpart_history_ref``), or
    ``None`` when memory is unavailable or there was nothing to write.
    """
    key = counterpart_key(name, organization)
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


def forget(ref: str) -> int | None:
    """Delete everything remembered under ``ref``. Returns rows deleted, or
    ``None`` when memory is unavailable (distinct from 0 = nothing to forget)."""
    key = resolve_key(ref)
    if not key:
        return None
    conn = _connect()
    if conn is None:
        return None
    try:
        with conn:
            cur = conn.execute(
                "DELETE FROM counterpart_memory WHERE counterpart_key = %s", (key,)
            )
            return cur.rowcount
    except Exception:
        logger.warning("counterpart memory delete failed", exc_info=True)
        return None
    finally:
        conn.close()


def history_to_claims(history: dict | None) -> list[dict]:
    """Turn remembered commitments into ``EvidenceClaim``-shaped dicts.

    Lane A merges these into the brief at ingest; they appear with the
    ``memory`` provenance badge and still need the user's keep/reject. When the
    record was matched by name only, the claim says so.
    """
    if not history:
        return []
    ref = history["ref"]
    caveat = (
        " (matched by name only — check it is the same person)"
        if history.get("match") == "name_only"
        else ""
    )
    return [
        {
            "claim": f"You previously committed: {text}{caveat}",
            "source_ids": [f"memory:{ref}"],
            "confidence": "medium",
            "relevance": "commitment",
            "provenance": "memory",
            "decision": "pending",
        }
        for text in history.get("commitments", [])
    ]
