"""Exa research client — scoped public research → provenance-labeled claims.

Bounded retrieval, never open-ended browsing. Returns EvidenceClaim-shaped
dicts with provenance="web" and decision="pending" so results land in the
same keep/reject gate as private evidence.
"""

from __future__ import annotations

import os
from typing import Any

_client = None
_client_tried = False


def get_client() -> Any | None:
    """Return an Exa client, or None if unconfigured/unavailable."""
    global _client, _client_tried
    if _client_tried:
        return _client
    _client_tried = True
    api_key = os.environ.get("EXA_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        from exa_py import Exa

        _client = Exa(api_key=api_key)
    except Exception:
        _client = None
    return _client


def research(
    topic: str,
    *,
    counterpart_name: str | None = None,
    organization: str | None = None,
    num_results: int = 4,
) -> dict:
    """Run a scoped Exa search and return claims + sources.

    Returns {"claims": [...], "sources": [...], "degraded": bool, "reason": str?}.
    Claims are EvidenceClaim-shaped; sources are ContextSource-shaped so the
    brief can merge them. source_ids on claims point at source_ids in sources.
    """
    client = get_client()
    if client is None:
        return {
            "claims": [],
            "sources": [],
            "degraded": True,
            "reason": "EXA_API_KEY not set or exa-py unavailable",
        }

    query_parts = [topic.strip()]
    if counterpart_name:
        query_parts.append(counterpart_name)
    if organization:
        query_parts.append(organization)
    query = " ".join(p for p in query_parts if p)[:400]
    if not query:
        return {
            "claims": [],
            "sources": [],
            "degraded": True,
            "reason": "empty research query",
        }

    try:
        results = client.search(
            query,
            num_results=num_results,
            contents={"highlights": True},
        )
    except Exception as exc:
        return {
            "claims": [],
            "sources": [],
            "degraded": True,
            "reason": f"exa search failed: {exc}",
        }

    claims: list[dict] = []
    sources: list[dict] = []
    items = getattr(results, "results", None) or []
    for index, item in enumerate(items):
        url = getattr(item, "url", None)
        # source_id is the result URL per the pinned contract; exa-N only
        # when a result somehow has no URL.
        source_id = url or f"exa-{index + 1}"
        title = getattr(item, "title", None) or url or f"Result {index + 1}"
        sources.append(
            {
                "source_id": source_id,
                "provider": "exa",
                "title": title,
                "author": getattr(item, "author", None),
                "timestamp": getattr(item, "published_date", None),
                "url": url,
            }
        )
        highlights = getattr(item, "highlights", None) or []
        for highlight in highlights[:2]:
            text = str(highlight).strip()
            if len(text) < 24:
                continue
            claims.append(
                {
                    "claim": text.rstrip("."),
                    "source_ids": [source_id],
                    "confidence": "medium",
                    "relevance": "market",
                    "provenance": "web",
                    "decision": "pending",
                }
            )

    return {"claims": claims, "sources": sources, "degraded": False}
