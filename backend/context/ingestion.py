"""Forwarded-thread ingestion: inbox messages → draft event + evidence brief.

Pipeline: fetch messages → normalize to thread text → sanitize → deterministic
extract → label provenance. Falls back to the bundled seed thread when the
inbox is unconfigured or empty, so the flow stays demoable without creds.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from graph.context import extract_brief_from_paste
from graph.state import ContextBrief, ContextSource, ScoutEvent

from . import agentmail_client, memory
from .fixtures import SEED_DANA_MESSAGES
from .safety import sanitize_thread_text


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _scout(action: str, detail: str, sources: list[str] | None = None) -> ScoutEvent:
    event: ScoutEvent = {
        "ts": _now(),
        "actor": "scout",
        "action": action,
        "detail": detail,
    }
    if sources:
        event["sources"] = sources
    return event


def _format_thread(messages: list[dict]) -> str:
    """Render normalized inbox messages into the From:/Subject:/Date: block
    format the deterministic extractor already understands."""
    blocks = []
    for msg in messages:
        header = (
            f"From: {msg['from']}\nSubject: {msg['subject']}\nDate: {msg['timestamp']}"
        )
        blocks.append(f"{header}\n\n{msg['text']}".strip())
    return "\n\n".join(b for b in blocks if b)


def _guess_counterpart(messages: list[dict]) -> str:
    """Pick the most frequent non-user sender as the counterpart name."""
    counts: dict[str, int] = {}
    for msg in messages:
        sender = (msg.get("from") or "").strip()
        if not sender or sender.lower() in {"you", "me"}:
            continue
        name = re.sub(r"<[^>]+>", "", sender).strip().strip('"')
        if name:
            counts[name] = counts.get(name, 0) + 1
    if not counts:
        return "the counterpart"
    return max(counts, key=counts.get)


def _counterpart_organization(messages: list[dict], counterpart: str) -> str:
    """The counterpart's email domain, e.g. "meridianlabs.com" — "" when their
    address is missing or a free-mail provider (which identifies nobody)."""
    for msg in messages:
        sender = (msg.get("from") or "").strip()
        name = re.sub(r"<[^>]+>", "", sender).strip().strip('"')
        if name != counterpart:
            continue
        match = re.search(r"[\w.+-]+@([\w-]+(?:\.[\w-]+)+)", sender)
        if match and memory.organization_key(match.group(1)):
            return match.group(1).lower()
    return ""


def _guess_stakes(messages: list[dict]) -> str:
    for msg in messages:
        if msg.get("subject"):
            return f"Conversation about: {msg['subject']}"
    return "A conversation that matters."


def _label_brief_provenance(
    brief: ContextBrief, provenance: str, provider: str
) -> ContextBrief:
    for claim in brief.get("claims", []):
        claim["provenance"] = provenance  # type: ignore[typeddict-item]
    for source in brief.get("sources", []):
        source["provider"] = provider  # type: ignore[typeddict-item]
    return brief


def _verbatim_passage(thread_text: str, claim_text: str) -> str | None:
    """Recover the exact sentence a claim was extracted from — the claim text is
    that sentence minus its terminal punctuation, so a substring match restores
    the verbatim quote for the citation."""
    index = thread_text.find(claim_text)
    if index < 0:
        return None
    end = index + len(claim_text)
    if thread_text[end : end + 1] in ".!?":
        end += 1
    return thread_text[index:end].strip()


def _attach_inbox_citations(brief: ContextBrief, thread_text: str) -> None:
    """Inbox claims cite the verbatim passage and the message's own timestamp.

    Email has no http URL, so source_url stays absent per the pinned contract.
    Called before memory claims merge — remembered claims carry no quote.
    """
    source_by_id = {s["source_id"]: s for s in brief.get("sources", [])}
    for claim in brief.get("claims", []):
        if claim.get("provenance") != "inbox":
            continue
        quote = _verbatim_passage(thread_text, str(claim.get("claim") or ""))
        if quote:
            claim["quote"] = quote  # type: ignore[typeddict-item]
        source_ids = claim.get("source_ids") or []
        source = source_by_id.get(source_ids[0]) if source_ids else None
        if source and source.get("timestamp"):
            claim["fetched_at"] = source["timestamp"]  # type: ignore[typeddict-item]


def import_from_inbox(limit: int = 10) -> dict:
    """Pull the agent's inbox and produce a draft event + evidence brief.

    Response shape (pinned in docs/HACKATHON_SPLIT.md):
      { event: {...} | None, brief: ContextBrief | None, scout_log: [...],
        degraded: bool, reason?: str, source: "agentmail" | "fixture" }
    """
    scout_log: list[ScoutEvent] = []
    messages = agentmail_client.list_messages(limit=limit)
    degraded = False
    source = "agentmail"

    if not messages:
        degraded = True
        source = "fixture"
        messages = SEED_DANA_MESSAGES
        scout_log.append(
            _scout(
                "inbox_fallback",
                "Inbox unavailable — using the bundled seed thread for this run.",
            )
        )
    else:
        scout_log.append(
            _scout("inbox_read", f"Read {len(messages)} message(s) from the inbox.")
        )

    thread_text = _format_thread(messages)
    clean_text, quarantined = sanitize_thread_text(thread_text)
    if quarantined:
        scout_log.append(
            _scout(
                "quarantined",
                f"Withheld {len(quarantined)} suspicious line(s) from extraction.",
            )
        )

    counterpart = _guess_counterpart(messages)
    brief = _label_brief_provenance(
        extract_brief_from_paste(clean_text, counterpart_name=counterpart),
        provenance="inbox",
        provider="agentmail" if not degraded else "manual",
    )
    _attach_inbox_citations(brief, clean_text)
    if quarantined:
        brief["sensitive_redactions"] = list(
            brief.get("sensitive_redactions") or []
        ) + [f"quarantined: {line[:80]}" for line in quarantined]

    claim_count = len(brief.get("claims", []))
    scout_log.append(
        _scout(
            "extracted",
            f"Extracted {claim_count} claim(s) from the thread with {counterpart}.",
        )
    )

    # Counterpart memory: remembered commitments/assumptions join the same
    # keep/reject gate as provenance="memory" claims. None/[] when no DB.
    counterpart_history_ref = None
    organization = _counterpart_organization(messages, counterpart)
    history = memory.get_history(counterpart, organization=organization or None)
    if history:
        counterpart_history_ref = history["ref"]
        mem_claims = memory.history_to_claims(history)
        brief["claims"] = list(brief.get("claims") or []) + mem_claims
        remembered = history.get("commitments") or []
        if remembered:
            brief["open_commitments"] = list(brief.get("open_commitments") or []) + [
                f"remembered: {c}" for c in remembered
            ]
        scout_log.append(
            _scout(
                "remembered",
                f"Recalled {len(remembered)} commitment(s) and "
                f"{len(history.get('assumptions') or [])} assumption(s) about {counterpart}.",
            )
        )

    event = {
        "scenario_id": "inbox_thread",
        "stakes": _guess_stakes(messages),
        "counterpart_profile": {
            "name": counterpart,
            "organization": organization,
            "role": "",
            "style": [],
            "leverage": "",
            "concerns": brief.get("counterpart_history", [])[:4],
        },
    }

    result = {
        "event": event,
        "brief": brief,
        "scout_log": scout_log,
        "degraded": degraded,
        "source": source,
        "agent_inbox_address": agentmail_client.ensure_inbox(),
        "counterpart_history_ref": counterpart_history_ref,
    }
    if degraded:
        result["reason"] = "AGENTMAIL_API_KEY not set or inbox empty"
    return result


def normalize_messages_to_sources(messages: list[dict]) -> list[ContextSource]:
    """Map inbox messages to ContextSource entries (provider: agentmail)."""
    sources: list[ContextSource] = []
    for index, msg in enumerate(messages):
        sources.append(
            {
                "source_id": msg.get("message_id") or f"agentmail-{index + 1}",
                "provider": "agentmail",
                "title": msg.get("subject") or f"Inbox message {index + 1}",
                "author": msg.get("from"),
                "timestamp": msg.get("timestamp") or None,
                "url": None,
            }
        )
    return sources
