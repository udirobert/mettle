"""Record the sample meeting's public research with Solari and bundle it.

Runs one real, recorded Solari session over a few public pages relevant to the
sample LP renewal, then writes:

- frontend/public/replays/<label>.ndjson    the rrweb recording, served statically
- frontend/src/fixtures/sample-research.json the draft brief, pointing at it

so the demo path always carries evidence you can watch being found, even on a
deployment without a Solari key.

Usage (from backend/):
    SOLARI_API_KEY=... uv run python -m scripts.record_sample [url ...]
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from research import solari

LABEL = "sample-lp-renewal"

# Context Elena will bring into the room: liquidity, secondaries, fees.
# ILPA turns away plain scrapers, so the session runs hardened (stealth + CAPTCHA).
DEFAULT_URLS = [
    "https://ilpa.org/industry-guidance/principles/",
    "https://en.wikipedia.org/wiki/Private_equity_secondary_market",
    "https://en.wikipedia.org/wiki/Management_fee",
]

ROOT = Path(__file__).resolve().parents[2]
REPLAY_OUT = ROOT / "frontend" / "public" / "replays" / f"{LABEL}.ndjson"
BRIEF_OUT = ROOT / "frontend" / "src" / "fixtures" / "sample-research.json"


async def main(urls: list[str]) -> None:
    print(f"Recording {len(urls)} page(s) in one hardened Solari session…")
    brief = await solari.research_public_pages(urls, hardened=True)
    if not brief["sources"]:
        raise SystemExit("No Solari session was created.")
    session_id = brief["sources"][0]["replay_session_id"]
    # Point the bundled brief at the static copy, not the live (expiring) session.
    for source in brief["sources"]:
        source["replay_session_id"] = LABEL
    print(f"Session {session_id}: {len(brief['claims'])} claim(s). Waiting for the replay…")

    replay = await solari.fetch_replay(session_id)
    if not replay:
        raise SystemExit("The replay never became available. Try again in a minute.")

    REPLAY_OUT.parent.mkdir(parents=True, exist_ok=True)
    REPLAY_OUT.write_bytes(replay)
    BRIEF_OUT.write_text(json.dumps(brief, indent=2) + "\n")
    print(f"Wrote {REPLAY_OUT.relative_to(ROOT)} ({len(replay) // 1024} KB)")
    print(f"Wrote {BRIEF_OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:] or DEFAULT_URLS))
