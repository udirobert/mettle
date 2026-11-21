#!/usr/bin/env python3
"""glasses_relay — Worn × M6 bridge (docs/WORN_M6.md, rungs 3-5).

Polls the Next.js relay (/api/glasses) and fans each whisper-tier card out
to every attached WhisperSink (scripts/glasses_sinks.py). The /glasses page
is the canned director; GlassesLiveBridge pushes real agent nudges —
whatever shows there is what the sinks emit.

Usage:
  python3 scripts/glasses_relay.py [BASE_URL] [--sink SINK ...] [--interval 0.3]

  BASE_URL defaults to http://localhost:3000 — pass the laptop's LAN URL
  (http://<mac-ip>:3000) when a bridge runs on another device.

  Sinks (repeatable — fan-out):
    --sink stdout        terminal print (default)
    --sink notify        macOS notification (non-private → redacted card)
    --sink adb[:SERIAL]  am broadcast to a sideloaded M6 viewer APK
    --sink http=URL      POST the card JSON to any endpoint (venue SDK,
                         localhost APK server, webhook)

Examples:
  python3 scripts/glasses_relay.py                                    # watch cards
  python3 scripts/glasses_relay.py --sink stdout --sink notify        # console + macOS
  python3 scripts/glasses_relay.py --sink http=http://localhost:9999/card
  python3 scripts/glasses_relay.py --sink adb:R5CT1234AB              # → M6 APK
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request

from glasses_sinks import build_sink

POLL_INTERVAL = 0.3


def poll(base: str, timeout: float = 2.0) -> dict | None:
    try:
        with urllib.request.urlopen(f"{base}/api/glasses", timeout=timeout) as r:
            return json.load(r)
    except Exception:
        return None


def main() -> int:
    ap = argparse.ArgumentParser(
        description="glasses_relay — whisper-tier cards → WhisperSinks",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("base_url", nargs="?", default="http://localhost:3000")
    ap.add_argument("--sink", action="append", default=[], metavar="SINK")
    ap.add_argument("--interval", type=float, default=POLL_INTERVAL)
    ap.add_argument("--dry-run", action="store_true", help="print raw payloads")
    args = ap.parse_args()
    base = args.base_url.rstrip("/")

    sinks = [build_sink(s) for s in (args.sink or ["stdout"])]
    names = ", ".join(s.name for s in sinks)
    print(
        f"glasses_relay → {base}/api/glasses → {names} (every {args.interval}s)",
        flush=True,
    )

    last = None
    while True:
        payload = poll(base)
        if payload is None:
            if last != "ERR":
                print("… relay unreachable, retrying", file=sys.stderr, flush=True)
            last = "ERR"
        elif payload.get("card") != last:
            last = payload["card"]
            if args.dry_run:
                print(json.dumps(payload), flush=True)
            else:
                card = payload["card"]
                tag = (
                    "LIVE"
                    if payload.get("mode") == "live"
                    else f"{payload['index'] + 1}/{payload['total']}"
                )
                print(f"[{tag}]", flush=True)
                for sink in sinks:
                    try:
                        sink.render(card)
                    except Exception as e:  # one bad sink must not starve the rest
                        print(f"      ! {sink.name}: {e}", file=sys.stderr, flush=True)
        time.sleep(args.interval)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        pass
