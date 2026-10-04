"""Prompt-injection filtering and redaction for ingested content.

Forwarded email and web results are untrusted input. This pass strips or
quarantines text aimed at the agent before it ever reaches extraction or an
LLM prompt. It is intentionally conservative: it drops whole suspicious lines
rather than trying to surgically rewrite them.
"""

from __future__ import annotations

import re

_INJECTION_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"ignore\s+(all|any|the|your)?\s*(previous|prior|above)\s+(instructions?|prompts?|rules?)",
        r"disregard\s+(all|any|the|your)?\s*(previous|prior|above)",
        r"(reveal|show|print|leak)\s+(your|the)\s+(system|hidden|initial)\s+(prompt|instructions?)",
        r"you\s+are\s+now\s+(a|an|in)",
        r"new\s+(system\s+)?instructions?\s*:",
        r"<\s*/?(system|assistant|developer)\s*>",
        r"\bdo\s+not\s+follow\b.{0,40}\b(safety|policy|guardrail)",
    ]
]


def sanitize_thread_text(text: str) -> tuple[str, list[str]]:
    """Return (cleaned_text, quarantined_lines) for an untrusted thread.

    Lines matching injection patterns are removed and reported so the brief
    can list them under sensitive_redactions — the user sees that something
    was withheld without the content reaching any prompt.
    """
    kept: list[str] = []
    quarantined: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped and any(p.search(stripped) for p in _INJECTION_PATTERNS):
            quarantined.append(stripped)
        else:
            kept.append(line)
    return "\n".join(kept), quarantined
