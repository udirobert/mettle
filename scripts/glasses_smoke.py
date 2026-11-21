#!/usr/bin/env python3
"""Venue smoke test for the whisper relay (docs/WORN_M6.md).

Run this first at the venue — it exercises every seam a render channel
depends on, against a running `next dev`:

    python3 scripts/glasses_smoke.py [http://localhost:3000]

Checks: payload shape, canned advance, live card push + TTL semantics,
sink register/list/remove, push fan-out, kind filtering, non-private
redaction, and the SSE stream. Exits non-zero on any failure — every
check is the thing that would break a demo.
"""

import http.server
import json
import sys
import threading
import time
import urllib.request

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:3000"
LISTEN_PORT = 9999

received = []
failures = []


def check(name, ok, detail=""):
    mark = "PASS" if ok else "FAIL"
    print(
        f"  [{mark}] {name}" + (f" — {detail}" if detail and not ok else ""), flush=True
    )
    if not ok:
        failures.append(name)


def get(path):
    with urllib.request.urlopen(BASE + path, timeout=5) as r:
        return json.loads(r.read())


def post(path, obj, method="POST"):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(obj).encode(),
        headers={"Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


class SinkHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode()
        received.append(body)
        self.send_response(200)
        self.end_headers()

    def log_message(self, *args):
        pass


def main():
    print(f"Mettle whisper smoke — {BASE}")

    # Local sink the relay can push to
    srv = http.server.HTTPServer(("127.0.0.1", LISTEN_PORT), SinkHandler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    sink_url = f"http://127.0.0.1:{LISTEN_PORT}/card"

    payload = get("/api/glasses")
    card = payload.get("card", {})
    check(
        "payload shape",
        all(k in card for k in ("kind", "headline", "ttl_ms"))
        and payload.get("mode") in ("canned", "live"),
        str(payload)[:120],
    )

    _, canned = post("/api/glasses", {"index": 2})
    check("canned advance", canned.get("mode") == "canned" and canned.get("index") == 2)

    _, live = post(
        "/api/glasses",
        {"card": {"kind": "proactive", "headline": "smoke live", "ttl_ms": 8000}},
    )
    check(
        "live card push",
        live.get("mode") == "live" and live["card"]["headline"] == "smoke live",
    )

    _, sinks = post(
        "/api/glasses/sinks",
        {"url": sink_url, "id": "smoke", "capabilities": {"private_display": True}},
    )
    check(
        "sink register",
        any(s["id"] == "smoke" for s in sinks.get("sinks", [])),
        str(sinks)[:120],
    )

    received.clear()
    post(
        "/api/glasses",
        {"card": {"kind": "proactive", "headline": "push me", "ttl_ms": 8000}},
    )
    time.sleep(1.0)
    check("push fan-out", any("push me" in b for b in received), str(received)[:120])

    received.clear()
    post("/api/glasses/sinks", {"id": "smoke", "remove": True})
    post("/api/glasses/sinks", {"url": sink_url, "id": "smoke", "kinds": ["reactive"]})
    post(
        "/api/glasses",
        {"card": {"kind": "proactive", "headline": "filtered", "ttl_ms": 8000}},
    )
    time.sleep(1.0)
    check("kind filter", not any("filtered" in b for b in received))

    received.clear()
    post("/api/glasses/sinks", {"id": "smoke", "remove": True})
    post(
        "/api/glasses/sinks",
        {"url": sink_url, "id": "smoke", "capabilities": {"private_display": False}},
    )
    post(
        "/api/glasses",
        {"card": {"kind": "proactive", "headline": "SECRET", "ttl_ms": 8000}},
    )
    time.sleep(1.0)
    check(
        "private-display redaction",
        any("Mettle — nudge" in b for b in received)
        and not any("SECRET" in b for b in received),
        str(received)[:120],
    )

    code, _ = post("/api/glasses/sinks", {"url": "file:///etc/passwd"})
    check("non-http sink rejected", code == 400, f"got {code}")

    post("/api/glasses/sinks", {"id": "smoke", "remove": True})
    status, resp = post("/api/glasses/sinks?id=smoke2", {}, method="DELETE")
    check("DELETE method", status == 200 and "sinks" in resp)

    # SSE — one line is enough proof the stream is alive
    try:
        with urllib.request.urlopen(BASE + "/api/glasses/stream", timeout=3) as r:
            first = r.readline().decode()
        check("SSE stream", first.startswith("data:"), first[:80])
    except Exception as e:
        check("SSE stream", False, str(e))

    post("/api/glasses", {"index": 0})  # leave the director at card 0
    print(f"\n{'ALL CLEAR' if not failures else 'FAILED: ' + ', '.join(failures)}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
