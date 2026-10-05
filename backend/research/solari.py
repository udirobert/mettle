"""Scoped public research through Solari's recorded cloud browser.

"Research with receipts": the user names a handful of public pages, a
recorded Solari session reads them, and every extracted claim keeps a pointer
to the replay so the user can watch exactly how the fact was gathered.

Deliberately bounded, per docs/CONTEXT_INGESTION.md:
- The user supplies the URLs. No open-ended browsing, no search loop.
- Claims come back `decision: "pending"` and go through the same Keep /
  Reject gate as pasted threads. Nothing reaches Coach unapproved.
- Never used during Live. Wingman stays on the approved brief.
"""

from __future__ import annotations

import asyncio
import os
import re
from urllib.parse import urlsplit

from graph.context import _classify_sentence
from graph.state import ContextBrief, EvidenceClaim

MAX_URLS = 5
MAX_CLAIMS_PER_PAGE = 5
NAV_TIMEOUT_MS = 20_000
# rrweb batches events; give it a moment to flush before releasing the session.
RRWEB_FLUSH_S = 2
# The replay uploads asynchronously after release, so the first fetch usually
# 404s even on a good recording. Poll this long before giving up.
REPLAY_POLL_ATTEMPTS = 10
REPLAY_POLL_INTERVAL_S = 3

_SESSION_ID = re.compile(r"^[\w-]{6,128}$")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
_CLAIM_PRIORITY = {
    "number": 0,
    "commitment": 1,
    "objection": 2,
    "risk": 3,
    "timeline": 4,
}


class ResearchUnavailable(RuntimeError):
    """Raised when SOLARI_API_KEY is not configured on this deployment."""


def is_configured() -> bool:
    return bool(os.getenv("SOLARI_API_KEY"))


def valid_session_id(session_id: str) -> bool:
    return bool(_SESSION_ID.match(session_id))


def normalize_urls(urls: list[str]) -> list[str]:
    """Keep unique http(s) URLs, capped at MAX_URLS."""
    cleaned: list[str] = []
    for raw in urls:
        url = raw.strip()
        parts = urlsplit(url)
        if parts.scheme not in {"http", "https"} or not parts.netloc:
            continue
        if len(url) > 2048 or url in cleaned:
            continue
        cleaned.append(url)
    return cleaned[:MAX_URLS]


def _client():
    api_key = os.getenv("SOLARI_API_KEY")
    if not api_key:
        raise ResearchUnavailable("SOLARI_API_KEY is not set")
    from solari_browser import Solari

    return Solari(api_key=api_key)


def claims_from_page_text(text: str, source_id: str) -> list[EvidenceClaim]:
    """Pick the few sentences on a page most likely to change the prep."""
    sentences: list[str] = []
    for paragraph in text.splitlines():
        paragraph = " ".join(paragraph.split())
        if len(paragraph) < 24:
            continue
        sentences.extend(
            part.strip()
            for part in _SENTENCE_SPLIT.split(paragraph)
            if 24 <= len(part) <= 400
        )

    scored: list[tuple[int, int, str, str]] = []
    seen: set[str] = set()
    for index, sentence in enumerate(sentences):
        relevance = _classify_sentence(sentence)
        key = sentence.lower()
        if relevance is None or key in seen:
            continue
        seen.add(key)
        scored.append((_CLAIM_PRIORITY.get(relevance, 9), index, sentence, relevance))

    scored.sort()
    claims: list[EvidenceClaim] = []
    for _, _, sentence, relevance in scored[:MAX_CLAIMS_PER_PAGE]:
        claims.append(
            {
                "claim": sentence.rstrip("."),
                "source_ids": [source_id],
                # Public pages are context, not correspondence: never "high".
                "confidence": "medium" if relevance == "number" else "low",
                "relevance": relevance,  # type: ignore[typeddict-item]
                "decision": "pending",
            }
        )
    return claims


async def research_public_pages(urls: list[str]) -> ContextBrief:
    """Read each URL in one recorded Solari session and return a draft brief."""
    targets = normalize_urls(urls)
    brief: ContextBrief = {
        "status": "draft",
        "sources": [],
        "claims": [],
        "counterpart_history": [],
        "open_commitments": [],
        "sensitive_redactions": [],
        "user_approved_at": None,
    }
    if not targets:
        return brief

    async with _client() as solari:
        # Recording is opt-in per session; without it the replay 404s forever.
        browser = await solari.launch(recording=True, retries=1)
        session_id = browser.id
        try:
            page = await browser.new_page()
            for index, url in enumerate(targets):
                source_id = f"solari-{index + 1}"
                title = urlsplit(url).netloc
                text = ""
                try:
                    await page.goto(
                        url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS
                    )
                    title = (await page.title()).strip() or title
                    text = await page.locator("body").inner_text(timeout=NAV_TIMEOUT_MS)
                except Exception:  # noqa: BLE001 — one bad page must not sink the batch
                    text = ""
                brief["sources"].append(
                    {
                        "source_id": source_id,
                        "provider": "solari",
                        "title": title[:200],
                        "author": urlsplit(url).netloc,
                        "timestamp": None,
                        "url": url,
                        "replay_session_id": session_id,
                    }
                )
                brief["claims"].extend(claims_from_page_text(text, source_id))
            await asyncio.sleep(RRWEB_FLUSH_S)
        finally:
            # close() also releases the session; skipping it holds the slot.
            await browser.close()

    return brief


async def fetch_replay(session_id: str) -> bytes | None:
    """Return the rrweb NDJSON replay, polling while the async upload lands."""
    from solari_browser.errors import SolariError

    async with _client() as solari:
        for _ in range(REPLAY_POLL_ATTEMPTS):
            try:
                # The HTTP client honours Content-Encoding, so this is plain NDJSON.
                return await solari.sessions.download_replay(session_id)
            except SolariError as err:
                if err.status != 404:
                    raise
            await asyncio.sleep(REPLAY_POLL_INTERVAL_S)
    return None
