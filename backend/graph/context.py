"""Paste-path evidence extraction.

The unscalable demo path: the user forwards or pastes a thread, we extract
source-backed claims, and nothing enters Coach state until they approve.
No OAuth. Deterministic extraction so the paste path works without a model.
"""

from __future__ import annotations

import re
from typing import Literal

from .state import ContextBrief

SAMPLE_ELENA_THREAD = """\
From: Elena Park
Date: 15 Oct 2024
Subject: Re: Q3 Performance Review

Before we discuss a new commitment, I need a clearer picture of the liquidity timeline. DPI has lagged what we were led to expect at the last renewal. The fee step-up is hard to defend while cash-back is slow.

From: You
Date: 16 Oct 2024
Subject: Portfolio Construction Memo — Follow-up

Understood. I will send the portfolio-construction memo before we meet. The $40M renewal is the ask. Two concentrated positions still dominate unrealized value; the memo will address how we de-risk that.
"""

_FROM_SPLIT = re.compile(r"(?=(?:^|\n)From:\s*)", re.IGNORECASE)
_FROM_LINE = re.compile(r"^From:\s*(.+)$", re.IGNORECASE | re.MULTILINE)
_SUBJECT_LINE = re.compile(r"^Subject:\s*(.+)$", re.IGNORECASE | re.MULTILINE)
_DATE_LINE = re.compile(r"^Date:\s*(.+)$", re.IGNORECASE | re.MULTILINE)
_HEADER_LINE = re.compile(r"^(From|Date|Subject|To|Cc):\s*", re.IGNORECASE)
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
_MONEY = re.compile(r"\$[\d,.]+(?:\s*(?:[Mm]|million))?")
_COMMIT = re.compile(
    r"\b(commit(?:ted|ment)?|promis(?:e|ed)|will send|follow-?up|memo)\b",
    re.IGNORECASE,
)
_OBJECTION = re.compile(
    r"\b(concern|flagged|lag(?:ged)?|skeptic|hard to defend|worry|object|behind|lack)\b",
    re.IGNORECASE,
)
_RISK = re.compile(
    r"\b(reduc(?:e|ed)|risk|reputational|unwind|concentrat)\b",
    re.IGNORECASE,
)
_TIMELINE = re.compile(
    r"\b(timeline|before we meet|deadline|Q[1-4]|this time)\b",
    re.IGNORECASE,
)

_Relevance = Literal[
    "stakes",
    "counterpart",
    "objection",
    "commitment",
    "number",
    "timeline",
    "market",
    "company",
    "person",
    "risk",
]


def _empty_brief() -> ContextBrief:
    return {
        "status": "draft",
        "sources": [],
        "claims": [],
        "counterpart_history": [],
        "open_commitments": [],
        "sensitive_redactions": [],
        "user_approved_at": None,
    }


def _split_blocks(text: str) -> list[str]:
    blocks = [block.strip() for block in _FROM_SPLIT.split(text) if block.strip()]
    return blocks or [text.strip()]


def _classify_sentence(sentence: str) -> _Relevance | None:
    if _MONEY.search(sentence):
        return "number"
    if _COMMIT.search(sentence):
        return "commitment"
    if _OBJECTION.search(sentence):
        return "objection"
    if _RISK.search(sentence):
        return "risk"
    if _TIMELINE.search(sentence):
        return "timeline"
    return None


def _iter_body_sentences(block: str) -> list[str]:
    body_lines = [
        line.strip()
        for line in block.splitlines()
        if line.strip() and not _HEADER_LINE.match(line)
    ]
    body = " ".join(body_lines)
    sentences = [part.strip() for part in _SENTENCE_SPLIT.split(body) if part.strip()]
    return [sentence for sentence in sentences if len(sentence) >= 24]


def _heuristic_extract(text: str, counterpart_name: str) -> ContextBrief:
    brief = _empty_brief()
    blocks = _split_blocks(text)

    for index, block in enumerate(blocks):
        source_id = f"paste-{index + 1}"
        from_match = _FROM_LINE.search(block)
        subject_match = _SUBJECT_LINE.search(block)
        date_match = _DATE_LINE.search(block)
        author = (
            from_match.group(1).strip() if from_match else None
        ) or counterpart_name
        title = (
            subject_match.group(1).strip()
            if subject_match
            else f"Pasted thread {index + 1}"
        )
        brief["sources"].append(
            {
                "source_id": source_id,
                "provider": "manual",
                "title": title,
                "author": author,
                "timestamp": date_match.group(1).strip() if date_match else None,
                "url": None,
            }
        )

        for sentence in _iter_body_sentences(block):
            relevance = _classify_sentence(sentence)
            if relevance is None:
                continue
            brief["claims"].append(
                {
                    "claim": sentence.rstrip("."),
                    "source_ids": [source_id],
                    "confidence": "high"
                    if relevance in {"number", "commitment"}
                    else "medium",
                    "relevance": relevance,
                    "decision": "pending",
                }
            )
            if relevance == "commitment":
                brief["open_commitments"].append(sentence.rstrip("."))
            if author.lower() != "you" and relevance in {"objection", "risk", "number"}:
                brief["counterpart_history"].append(sentence.rstrip("."))

    # If classification missed everything, keep the first two body sentences
    # so approval is never an empty theater.
    if not brief["claims"]:
        for index, block in enumerate(blocks):
            sentences = _iter_body_sentences(block)
            for sentence in sentences[:2]:
                brief["claims"].append(
                    {
                        "claim": sentence.rstrip("."),
                        "source_ids": [f"paste-{index + 1}"],
                        "confidence": "medium",
                        "relevance": "counterpart",
                        "decision": "pending",
                    }
                )

    return brief


def extract_brief_from_paste(
    text: str,
    *,
    counterpart_name: str = "Elena Park",
) -> ContextBrief:
    """Turn pasted correspondence into a draft evidence brief."""
    cleaned = text.strip()
    if not cleaned:
        return _empty_brief()
    return _heuristic_extract(cleaned, counterpart_name)


def approved_claims(brief: ContextBrief | None) -> list:
    """Claims the human explicitly kept. Legacy claims without decision count as approved."""
    if not brief:
        return []
    claims = []
    for claim in brief.get("claims") or []:
        decision = claim.get("decision")
        if decision == "rejected":
            continue
        if decision == "pending":
            continue
        # approved, or missing (older fixtures / skip-paste path)
        if decision in (None, "approved") and claim.get("claim"):
            claims.append(claim)
    return claims


def format_evidence_for_coach(brief: ContextBrief | None) -> str:
    """Render human-approved claims for Coach prompts. Empty if none kept."""
    if not brief or brief.get("status") != "approved":
        return "No approved evidence brief. Do not invent prior correspondence."

    claims = approved_claims(brief)
    if not claims:
        return "An evidence brief was approved but contains no kept claims."

    lines = ["Approved evidence from the user's thread (treat as ground truth):"]
    for claim in claims:
        relevance = claim.get("relevance", "counterpart")
        lines.append(f"  - [{relevance}] {claim['claim']}")

    history = [
        item
        for item in (brief.get("counterpart_history") or [])
        if item in {claim["claim"] for claim in claims}
    ]
    if history:
        lines.append("Counterpart has already said:")
        lines.extend(f"  - {item}" for item in history)

    commitments = [
        item
        for item in (brief.get("open_commitments") or [])
        if item in {claim["claim"] for claim in claims}
    ]
    if commitments:
        lines.append("Open commitments by the user:")
        lines.extend(f"  - {item}" for item in commitments)

    return "\n".join(lines)
