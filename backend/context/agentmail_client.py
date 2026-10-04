"""AgentMail client — the agent's own inbox.

The agent reads only mail addressed to it. All functions degrade to None/[]
when AGENTMAIL_API_KEY or the `agentmail` package is unavailable, so every
route and node can call them unconditionally.
"""

from __future__ import annotations

import os
from typing import Any

_client = None
_client_tried = False


def get_client() -> Any | None:
    """Return an AgentMail client, or None if unconfigured/unavailable."""
    global _client, _client_tried
    if _client_tried:
        return _client
    _client_tried = True
    api_key = os.environ.get("AGENTMAIL_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        from agentmail import AgentMail

        _client = AgentMail(api_key=api_key)
    except Exception:
        _client = None
    return _client


def ensure_inbox() -> str | None:
    """Return the agent's inbox id (email address), creating one if needed.

    Honors AGENTMAIL_INBOX_ID when set; otherwise creates a persistent inbox.
    Returns None when no client is available.
    """
    configured = os.environ.get("AGENTMAIL_INBOX_ID", "").strip()
    if configured:
        return configured
    client = get_client()
    if client is None:
        return None
    try:
        inbox = client.inboxes.create(client_id="mettle-agent-v1")
        return getattr(inbox, "inbox_id", None)
    except Exception:
        return None


def _msg_attr(msg: Any, *names: str) -> Any:
    for name in names:
        value = getattr(msg, name, None)
        if value is not None:
            return value
    return None


def list_messages(limit: int = 10) -> list[dict]:
    """Fetch recent inbox messages normalized to plain dicts."""
    client = get_client()
    inbox_id = ensure_inbox()
    if client is None or not inbox_id:
        return []
    try:
        result = client.inboxes.messages.list(inbox_id, limit=limit)
        items = getattr(result, "messages", None) or (
            result if isinstance(result, list) else []
        )
    except Exception:
        return []

    normalized = []
    for msg in items:
        normalized.append(
            {
                "message_id": str(_msg_attr(msg, "message_id", "id") or ""),
                "from": str(_msg_attr(msg, "from_", "from_addr", "sender") or ""),
                "to": str(_msg_attr(msg, "to") or ""),
                "subject": str(_msg_attr(msg, "subject") or ""),
                "text": str(_msg_attr(msg, "extracted_text", "text", "preview") or ""),
                "timestamp": str(
                    _msg_attr(msg, "timestamp", "created_at", "date") or ""
                ),
            }
        )
    return normalized


def send_memo(to: str, subject: str, text: str) -> dict | None:
    """Send the debrief memo from the agent's own inbox."""
    client = get_client()
    inbox_id = ensure_inbox()
    if client is None or not inbox_id:
        return None
    try:
        sent = client.inboxes.messages.send(inbox_id, to=to, subject=subject, text=text)
        return {
            "message_id": str(_msg_attr(sent, "message_id", "id") or ""),
            "from": inbox_id,
            "to": to,
            "subject": subject,
        }
    except Exception:
        return None
