"""Whisper-tier emit — the backend end of the glasses channel.

docs/WORN_M6.md, "Long-term direction": the emit moves to the backend.
wingman_proactive / wingman_reactive publish the same card contract
({kind, headline, body, ttl_ms}) the frontend GlassesLiveBridge posts —
to GLASSES_RELAY_URL, the Next.js /api/glasses relay. Nudges now reach
whisper sinks with no browser open; the bridge stays as a redundant shim
(the relay dedupes identical cards).

Fire-and-forget: dispatched on a daemon thread, every failure swallowed —
the live path never blocks on the glasses channel.
"""

from __future__ import annotations

import json
import os
import threading
import urllib.request

RELAY_URL_ENV = "GLASSES_RELAY_URL"
DEFAULT_RELAY_URL = "http://localhost:3000/api/glasses"

HEADLINE_LIMIT = 60
BODY_LIMIT = 80
DEFAULT_TTL = {"phase": 3000, "proactive": 8000, "reactive": 12000}

_TRAIL = " ,;:–-—"


def _fit(text: str, max_chars: int) -> str:
    """Word-boundary trim, mirroring frontend/src/lib/glasses-card.ts fit()."""
    t = " ".join(text.strip().split())
    if len(t) <= max_chars:
        return t
    window = t[: max_chars - 1]
    space = window.rfind(" ")
    cut = space if space > max_chars * 0.5 else max_chars - 1
    return window[:cut].rstrip(_TRAIL) + "…"


def build_card(
    kind: str,
    headline: str,
    body: str | None = None,
    ttl_ms: int | None = None,
) -> dict:
    """Shape arbitrary text into the whisper-tier contract."""
    k = kind if kind in DEFAULT_TTL else "proactive"
    card: dict = {
        "kind": k,
        "headline": _fit(headline, HEADLINE_LIMIT),
        "ttl_ms": ttl_ms or DEFAULT_TTL[k],
    }
    if body:
        card["body"] = _fit(body, BODY_LIMIT)
    return card


def _post(payload: dict) -> None:
    url = os.environ.get(RELAY_URL_ENV, DEFAULT_RELAY_URL).rstrip("/")
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=1.0):
            pass
    except Exception:
        pass


def publish_card(
    kind: str,
    headline: str,
    body: str | None = None,
    ttl_ms: int | None = None,
) -> None:
    """Push one whisper-tier card to the relay. Never blocks, never raises."""
    payload = {"card": build_card(kind, headline, body, ttl_ms)}
    threading.Thread(target=_post, args=(payload,), daemon=True).start()


def publish_nudge(message: str) -> None:
    """Proactive nudge → headline-only card."""
    publish_card("proactive", message)


def publish_reply(reply: str) -> None:
    """Reactive answer → two-line card, mirroring replyToGlassesCard."""
    t = " ".join(reply.strip().split())
    if len(t) <= HEADLINE_LIMIT:
        publish_card("reactive", t)
        return
    window = t[:HEADLINE_LIMIT]
    space = window.rfind(" ")
    cut = space if space > HEADLINE_LIMIT * 0.5 else HEADLINE_LIMIT
    headline = t[:cut].rstrip(_TRAIL)
    publish_card("reactive", headline, t[cut:].strip() or None)
