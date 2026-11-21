#!/usr/bin/env python3
"""WhisperSink — the provider interface for the whisper channel.

docs/WORN_M6.md, "Long-term direction". One interface:

    render(card) · clear() · capabilities()

and one rule: the card contract ({kind, headline, body, ttl_ms}) never
grows per-provider fields — differences live in `capabilities`. Sinks
that aren't private displays get the redacted card from `present()`.

Sinks shipped today:
  stdout   — debug/default, private (your terminal)
  notify   — macOS `display notification`; NOT private (visible on screen,
             Notification Center history) → renders the redacted card.
             Works right now — the rung-3 analog you can demo on this Mac.
  http=URL — POSTs the card JSON anywhere: a venue SDK push endpoint, a
             localhost APK server, a webhook. The generic bridge.
  adb      — `am broadcast` to a sideloaded viewer APK on the M6
             (Android 9/W527 — glasses are the Android device; adb works
             from macOS over USB-C or WiFi).
"""

from __future__ import annotations

import json
import subprocess
import urllib.request
from dataclasses import dataclass, field


@dataclass(frozen=True)
class SinkCapabilities:
    max_chars: int = 60
    max_lines: int = 2
    supports_body: bool = True
    supports_bitmap: bool = False
    private_display: bool = True
    inputs: tuple[str, ...] = field(default_factory=tuple)


def present(sink: "WhisperSink", card: dict) -> dict:
    """What this sink is allowed to show. Non-private displays degrade to
    a content-free tap-target — nudge text is negotiation content
    (docs/WORN_M6.md, private_display)."""
    if sink.capabilities.private_display:
        return card
    return {**card, "headline": "Mettle — nudge", "body": None}


class WhisperSink:
    name = "base"
    capabilities = SinkCapabilities()

    def render(self, card: dict) -> None:
        raise NotImplementedError

    def clear(self) -> None:  # ttl_ms covers most sinks; override if needed
        pass


class StdoutSink(WhisperSink):
    name = "stdout"
    capabilities = SinkCapabilities(inputs=("stdout",))

    def render(self, card: dict) -> None:
        bar = {"phase": "=", "proactive": "*", "reactive": ">"}.get(card["kind"], "?")
        print(f"      {bar} {card['headline']}", flush=True)
        if card.get("body"):
            print(f"         {card['body']}", flush=True)


class MacNotificationSink(WhisperSink):
    name = "notify"
    capabilities = SinkCapabilities(
        max_lines=1,
        supports_body=False,
        private_display=False,  # lock screen + Notification Center history
    )

    def render(self, card: dict) -> None:
        text = present(self, card)["headline"].replace('"', '\\"')
        subprocess.run(
            ["osascript", "-e", f'display notification "{text}" with title "Mettle"'],
            check=False,
        )


class HttpPushSink(WhisperSink):
    """POST {kind, headline, body?, ttl_ms} to any URL — the generic bridge.
    Point it at a venue SDK endpoint, a localhost APK server, a webhook."""

    name = "http"
    capabilities = SinkCapabilities()

    def __init__(self, url: str) -> None:
        self.url = url
        self.name = f"http:{url}"

    def render(self, card: dict) -> None:
        req = urllib.request.Request(
            self.url,
            data=json.dumps(present(self, card)).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=2):
            pass


class AdbBroadcastSink(WhisperSink):
    """M6 viewer-APK path: broadcast extras the APK renders as a card.
    Requires adb + a viewer APK listening for the action — the venue build."""

    name = "adb"
    capabilities = SinkCapabilities(inputs=("touch_bar",))

    def __init__(
        self, serial: str | None = None, action: str = "com.mettle.GLASSES_CARD"
    ) -> None:
        self.serial = serial
        self.action = action

    def render(self, card: dict) -> None:
        shown = present(self, card)
        cmd = ["adb"]
        if self.serial:
            cmd += ["-s", self.serial]
        cmd += [
            "shell",
            "am",
            "broadcast",
            "-a",
            self.action,
            "--es",
            "headline",
            shown["headline"],
            "--es",
            "kind",
            shown["kind"],
            "--el",
            "ttl_ms",
            str(shown["ttl_ms"]),
        ]
        if shown.get("body"):
            cmd += ["--es", "body", shown["body"]]
        subprocess.run(cmd, check=False)


class M6SdkSink(WhisperSink):
    """Venue adapter — fill in after the SDK brief (ordered unknowns in
    docs/WORN_M6.md). Skeleton keeps the seam visible: import their SDK at
    the top, map render() → their text/bitmap push call, set
    capabilities to whatever the device actually supports.

    Not registered in build_sink() yet — wire it with a spec name when the
    push call exists. If the SDK only offers an on-device API, prefer the
    glasses-android/ APK (polls the relay itself) or AdbBroadcastSink.
    """

    name = "m6-sdk"
    capabilities = SinkCapabilities(
        max_chars=60,  # confirm against real line width at the venue
        max_lines=2,  # headline + body; drop to 1 if display is single-line
        supports_bitmap=False,  # flip if SDK pushes bitmaps instead of text
        private_display=True,  # a waveguide in your eye is private
        inputs=(),  # touch bar / ring / voice wake — fill when known
    )

    def __init__(self) -> None:
        raise NotImplementedError(
            "M6SdkSink is a template — read the venue SDK brief, then map "
            "render() to their push call (or use --sink adb / http= instead)"
        )


def build_sink(spec: str) -> WhisperSink:
    """--sink spec → instance. 'stdout' | 'notify' | 'adb[:SERIAL]' | 'http=URL'"""
    if spec == "stdout":
        return StdoutSink()
    if spec == "notify":
        return MacNotificationSink()
    if spec.startswith("adb"):
        serial = spec.split(":", 1)[1] if ":" in spec else None
        return AdbBroadcastSink(serial=serial)
    if spec.startswith("http="):
        return HttpPushSink(spec[5:])
    raise SystemExit(
        f"unknown sink: {spec} (stdout | notify | adb[:serial] | http=URL)"
    )
