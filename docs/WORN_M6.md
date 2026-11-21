# Worn × MicroLumin M6 — Mettle on your face

> **Active priority (Sat Nov 21, 2026):** Mettle's Live Wingman on MicroLumin
> M6 waveguide display glasses, for the Worn hardware hackathon at CUNY City
> Tech. Track 01 · Personal Insight. This file is the single source of truth
> for the glasses surface — do not restate the plan elsewhere.

## Event

| Field               | Value                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| **Event**           | Worn — MicroLumin M6 smart-glasses hackathon (theme: "Second nature")       |
| **Venue**           | CUNY City Tech, 285 Jay St, Brooklyn, rooms A105/A103                       |
| **Track**           | 01 · Personal Insight — AI that understands the person wearing it          |
| **Deadline**        | Sat Nov 21, 2:00 PM ET (Airtable, no late edits)                           |
| **Judging**         | Understands you · Adaptability (phone↔glasses) · Ergonomics · Works on     |
|                     | glasses · Impact — each 0–2, total /10. Below 1 avg on "works on glasses"  |
|                     | disqualifies.                                                               |
| **Prior work**      | Mettle predates the event — **disclose prior work** in the submission.      |
| **Event site**      | https://worn-hacks.com · hub: https://worn-hacks.com/participant-hub        |

## Why glasses are the Live surface, not a port

`docs/NORTH_STAR.md` already says it: *"The live wingman is a pocket surface,
not a second monitor."* A phone in your hand mid-negotiation is a prop the
other side can see. Glasses are the honest end-state of that line — the nudge
floats in your vision, your eyes stay on the counterpart, your hands stay on
the table. Every design principle Live mode already obeys (restraint-first,
one timely nudge beats ten observations, ≤20-word lines) is what a waveguide
display demands anyway. We are not redesigning for the glasses; the glasses
catch up to the design.

## The surface

The glasses render **one card at a time** — the same `NudgeCard` payload the
web Wingman emits today via `a2ui-surface`:

- **Proactive nudge** — the headline line only (e.g. *"You've conceded twice —
  stop anchoring against yourself"*). No card chrome, no buttons.
- **Reactive answer** — the two-line response to a spoken fragment.
- **Phase markers** — a one-word stamp when the conversation shifts
  (brief → live → debrief-ready). Optional; drop if it adds noise.

Everything else stays on the phone: the transcript view, the claim gate, the
council output, the debrief memo. **Each device does what it does best** —
that sentence is the Adaptability criterion's answer.

## Architecture

```
Mic (glasses/phone) ──► STT ──► phone runs the LangGraph agent
                                     │  rules pass → LLM enrichment (existing)
                                     ▼
                         whisper-tier payload ──► M6 display over SDK/BLE
```

- **Phone is the runtime.** `serve.py` + LangGraph stay on the paired phone or
  a reachable host; nothing agent-side moves onto the glasses.
- **Glasses are a display+mic client.** A thin M6 app (or SDK companion route)
  subscribes to the nudge stream and renders it. This is a new output channel,
  not a new agent.
- **Existing seams carry it.** `triggers/rules.py` (cheap rules pass),
  `wingman_proactive.py` (enriched nudge), `voice/livekit_adapter.py` (audio
  in) — all shipped. The glasses consume the same `a2ui-surface` stream the
  web `A2UINudgeHost` consumes.
- **Dev environment constraint:** macOS + iPhone only — no Android phone in
  the team. `adb` runs fine on Mac and the M6 *is* the Android device, so
  on-device sideloading is still on the table; what's costly is APK
  *iteration* (Android toolchain builds, no second Android device to test
  against). Prefer zero-build and SDK-push routes before writing an APK.

## Hardware facts (confirmed from public sources, Nov 21)

- **The M6 is a full Android computer**, not a dumb display: Android 9,
  Unisoc W527 SoC, 2GB RAM. APK sideload confirmed working in the wild
  (r/SmartGlasses: video playing on an M6 via an installed APK).
- **Display is monochrome green waveguide** — Optiark optical engine,
  "1-to-2" single engine feeding both eyes, ~25.8g modular clip-on.
  Exact resolution unpublished — keep the ≤60-char headline budget.
- **On-device mic + camera + speakers** exist (stock features: AI
  assistant, translation, photo/video). Input is temple touch + voice,
  standard for the class.
- **Companion app:** `MLVISION Secret Vision` is MicroLumin's app line
  (M5 precedent — "beams documents/contracts to glasses for private
  viewing"). If the M6 app exposes a teleprompter/notes/text-push
  feature, nudges can ride it with zero SDK work — verify on hardware.
- **Naming hazard:** ignore "Metavisi M6" (Qualcomm 865, 6DoF) — a
  different product that pollutes searches.

## Pinned contract (glasses payload)

```
NudgeCard (existing) → glasses render:
  { kind: "proactive" | "reactive" | "phase",
    headline: string,        # ≤ 60 chars, hard budget — waveguide line limit
    body?: string,           # ≤ 80 chars, reactive answers only
    ttl_ms: number }         # auto-clear; defaults ~8s proactive / sticky reactive
```

The web card keeps its full chrome; the glasses get `headline` + `body` only.
If the SDK pushes bitmaps instead of text, render the same two fields —
the contract is the copy budget, not the transport. Long-term this contract
is the provider-agnostic seam — see "Long-term direction" below.

## SDK status — what's known, what to confirm at the venue

MicroLumin's SDK is private — distributed at the event (Fri 6:35 PM
walkthrough, engineer on call). Nothing usable on the public web.

**Resolved without the SDK:**

1. APK sideload works — Android 9 / W527 / 2GB, standard Android rendering
   hits the waveguide display. So "write an APK" never depends on their SDK.
2. Display is mono green — one text channel, no color decisions.
3. Adjacent ecosystem if needed: HeyCyan-family BLE protocol is fully
   reverse-engineered (`ebowwa/HeyCyanSmartGlassesSDK`,
   `pepebot-space/nisaetus` ARCHITECTURE.md) — but for non-display glasses
   only. `xg-glass-sdk` (HKUST) is the right 4-primitive architecture
   reference (camera in / mic in / display out / audio out) but doesn't
   support MicroLumin.

**Still confirm at the venue, in this order:**

1. Fastest display-push route the SDK offers — a host-side push API
   (REST/WS from Mac, or iOS SDK) beats an on-device APK for us.
2. Whether Secret Vision / the M6 app has a text/teleprompter push —
   the zero-build lane.
3. Notification mirroring: do iOS notifications render on the display?
   If yes, any iPhone notification becomes a nudge channel with no code.
4. M6 mic app-accessible vs. phone-mic only (phone-mic is the default
   plan regardless).
5. Text rendering details: native text element vs. bitmap; line width /
   font size / lines visible.
6. Input surface: touch bar, ring, voice wake — whichever exists drives
   the reactive fragment path.

Keep the contract above stable regardless of the answers.

## Fallback ladder — every rung is a demo

Ordered by what we can already do toward what needs hardware answers.
Each rung is a complete demo; climb until one fails.

1. Web Wingman on a phone in hand — works today (disclose as prior work)
2. "Glasses preview" web page — whisper-tier payload rendered at display
   size, mono-green styling on black. **Built:** `/glasses` route serves
   `SALARY_REVIEW_GLASSES_SEQUENCE` (`frontend/src/fixtures/glasses-nudges.ts`);
   auto-plays on TTL, `?i=N` pins a card, keyboard-driven for the script.
3. M6 zero-build — scripted nudges via whichever render channel exists
   out of the box: Secret Vision text/teleprompter push, or iOS
   notification mirroring. No code, no SDK.
4. M6 scripted via SDK/APK — canned `salary_review` nudge sequence pushed
   through MicroLumin's SDK or a sideloaded viewer APK reading canned JSON.
   **Relay built:** the `/glasses` page is the director — it POSTs each index
   to `GET/POST /api/glasses` (SSE variant at `/api/glasses/stream`), and
   `scripts/glasses_relay.py` polls it and hands every card to a `render()`
   stub — the single swap point for SDK push, adb, or notification bridges.
   **APK scaffolded:** `glasses-android/` — one mono-green `TextView`
   polling the relay over WiFi (`--es relay http://<mac-ip>:3000`,
   persisted). Standard Android only; needs a Gradle build at the venue —
   no Android SDK on the dev Mac, so it is compile-untested.
5. M6 live — real rules→enrichment pipeline, phone-mic transcript, judge
   wears the glasses. **Live path built:** `GlassesLiveBridge` (mounted in
   `page.tsx`) taps `nudges_sent` / `reactive_reply` / `phase` and POSTs
   whisper-tier cards (`lib/glasses-card.ts` shapes them to the contract);
   POST `{card}` flips the relay to `mode:"live"`, any canned command takes
   the director back. Seeded on mount — restored state doesn't replay.

Aim for rung 5. Ship whatever the top working rung is at 1:30 PM.

## Long-term direction — the whisper channel, not a glasses feature

The M6 is the first consumer of a contract, not the product surface itself.
"Where does a nudge surface?" is a routing question, not a device question.
Do not build a provider framework now — the contract plus `render()` in
`glasses_relay.py` is the seam; a plugin registry gets designed wrong with
one real provider and one hypothetical. Extract it when the **second real
provider** lands (likely candidates, in order of relevance to Mettle's
users: Even Realities G1/G2 — documented open BLE text push; Meta Ray-Ban
Display — Wearables Device Access Toolkit; watch face / Live Activity;
lock-screen notification).

What survives into that refactor, by design today:

- **Latest-card state, not an event stream.** Glanceable displays want
  current state — reconnect and see the card, never replay missed nudges.
  The poll-based relay is correct; keep this semantic.
- **The contract stays fixed.** `kind / headline / body / ttl_ms` does not
  grow per-provider fields.
- **Capabilities live on the sink.** Each provider registers
  `{max_chars, max_lines, supports_body, supports_bitmap, inputs,
  private_display}`. `private_display` is the load-bearing one: nudge text
  is negotiation content — fine on a waveguide in your eye, must degrade to
  "Mettle: nudge" on a lock screen.
- **The emit moved to the backend (done Nov 21).** `backend/graph/whisper.py`
  publishes the same contract to `GLASSES_RELAY_URL` (default the Next.js
  `/api/glasses`) — daemon-thread fire-and-forget, never blocks the live
  path, silent on failure. `wingman_proactive` publishes on every nudge,
  `wingman_reactive` publishes every answer — nudges reach whisper sinks
  with no browser open. `GlassesLiveBridge` remains as a redundant shim
  (the relay dedupes identical cards; phase markers are still its job).
- **The interface to name when it exists:** `WhisperSink` —
  `render(card)`, `clear()`, `capabilities()`.

**Named and shipped (Nov 21):** `scripts/glasses_sinks.py` implements
`WhisperSink` + `SinkCapabilities` + `present()` (private-display
redaction); `scripts/glasses_relay.py` fans every card out to repeatable
`--sink` args. Working sinks today: `stdout`, `notify` (macOS notification
— non-private, renders "Mettle — nudge"; the rung-3 analog testable without
hardware), `http=URL` (POSTs the card JSON to any endpoint — the generic
venue bridge), `adb[:serial]` (`am broadcast` to a sideloaded M6 viewer
APK — glasses are the Android device). `M6SdkSink` is scaffolded in the
same file — a NotImplementedError template awaiting the venue SDK brief.
TS-side vocabulary mirror: `frontend/src/lib/glasses-sink.ts`.

**Registry landed (Nov 21):** `/api/glasses/sinks` — POST `{url, id?,
capabilities?, kinds?}` to register a push sink, `{id, remove:true}` to
drop it, GET to list. `fanoutCard` in `lib/glasses-state.ts` POSTs the
current card to every eligible registered sink on each `/api/glasses`
update: kind-filtered, `private_display:false` gets the redacted card,
per-sink failures are isolated and a sink is evicted after 5 consecutive
failures. In-memory only — demo scope, not a durable store. Still
deliberately missing: persistent registration and per-card routing — the
full framework waits for the second real provider.

Two refinements on the same pass: sink URLs are validated http(s)-only
(server-side fetch = SSRF surface), `DELETE /api/glasses/sinks?id=` works
alongside `{remove:true}`, and an expired live card now reverts to the
canned sequence server-side rather than pinning a stale nudge. Covered
by `src/lib/glasses-state.test.ts` (11 cases) and `scripts/glasses_smoke.py`
— the venue smoke test, run it first on-site:
`python3 scripts/glasses_smoke.py http://localhost:3000`.

## Demo arc (three minutes, worn by the team)

**Say:** "Mettle is the personal agent for the conversations you can't afford
to get wrong. It did its homework before this room — and now it stands next to
me in it."

1. **The walk-in (phone).** Show the scout log + one briefing line on the
   phone screen: *"You committed to March metrics — they never arrived."*
2. **The moment (glasses).** Teammate plays Dana. Judge/teammate wears the M6.
   Live nudge lands mid-sentence — *"She countered on title, not cash — that's
   cheap for her."* Eyes never left the counterpart.
3. **The loop closes (phone).** Debrief memo drafted on the phone. Brief on
   the walk in, whisper in the room, memo in your pocket — one agent, three
   surfaces, none of them a screen you stare at.

## Mapping to existing docs

- `docs/NORTH_STAR.md` — Form Factor Direction gains "glasses" as the Live
  end-state; the pocket-surface line stays true, the pocket moves to your face.
- `docs/DEMO_SCRIPT.md` — the web demo arc remains canonical for the product;
  the arc above is the on-device variant for Worn judging only.
- `docs/HACKATHON_SPLIT.md` — archived October lanes; merge rules and the
  "demo never depends on the riskiest item" rule carry forward verbatim.
- `CLAUDE.md` — Build Order item 8 tracks this work.
