# Worn submission draft — Mettle

> Working draft for the Airtable submission due **Sat Nov 21, 2:00 PM ET** —
> no late edits. Fill the bracketed bits after judging what actually ran on
> hardware. Track 01 · Personal Insight.

## Project name

Mettle — the personal agent for the conversations you can't afford to get wrong

## Tagline

An agent that does its homework, then whispers in your eye while your eyes
stay on the other person.

## The problem

The conversations that matter most — asking for the raise, the landlord
dispute, the co-founder reset — are the ones you can't delegate. Today's
"personal agents" answer email and order groceries; in the moment that
decides your salary, you're on your own. And the obvious fixes make it
worse: a phone in your hand mid-negotiation is a prop the other side can
see, and looking down at notes tells your counterpart exactly when you're
uncertain.

## What it does

Mettle is a counsel agent built around one consequential conversation.
Before the room, it does homework: it watches its own inbox for the threads
you forward it, extracts claims, runs research, and pressure-tests your
position with an adversarial council (a skeptic, your counterpart's voice,
and a negotiator). You rehearse against a roleplay of the real person.

In the room, **Wingman** watches the live transcript and surfaces nudges
unprompted only when a pattern is worth flagging — she countered on title,
not cash; you've conceded twice; that monologue is too long. On the M6,
each nudge is a single whisper-tier card in the waveguide: one green line,
auto-clearing, eyes never leaving the counterpart.

After the room, Debrief emails you the commitments memo and remembers the
counterpart for next time.

## How it works

A Python LangGraph agent (the `conversation_agent`) runs the phone side —
five modes: Scout, Coach, Opponent, Wingman, Debrief. When Wingman fires a
nudge, `whisper.py` shapes it into a stable card contract —
`{kind, headline ≤60 chars, body ≤80, ttl_ms}` — and publishes it
fire-and-forget to a relay. Sinks subscribe or poll the relay and render
the current card; the glasses never run agent logic and never replay
missed nudges — they show the _latest_ card, like real peripheral vision.

The same card contract serves every surface: a push-sink registry with
per-sink capabilities (`private_display` redacts negotiation content to
"Mettle — nudge" on shared surfaces), an SSE stream, a Python fan-out
relay (stdout / macOS notification / generic HTTP / adb broadcast), and
a zero-dependency Android viewer APK for the M6 itself — merged with
Worn's `GlassesAppTemplate` so it survives reboots and takes pushed
cards over Wi-Fi (`POST :8080/card`) with no cable.

## Prior work disclosure (required)

Mettle predates this event. Prior work: the five-mode LangGraph agent,
the CopilotKit/AG-UI web app, the Scout Mastra agent, AgentMail/Exa
ingestion, Neon Postgres memory, the proactive-nudge rules→enrichment
pipeline, and the reactive Wingman interrupt.

**Built at this event:** the entire whisper channel — the card contract,
`/api/glasses` relay + SSE stream, `whisper.py` backend emit wired into
both Wingman emit sites, the `WhisperSink` interface + sink registry +
fan-out (`scripts/glasses_sinks.py`, `glasses_relay.py`), private-display
redaction, the `/glasses` preview surface, the canned `salary_review`
sequence, the M6 viewer APK (`glasses-android/`), and the venue smoke
test. [Update with whichever render channel actually landed on hardware:
SDK push / teleprompter / sideloaded APK / notification mirror.]

## Demo

Three minutes, worn by the team. We walk in with the scout brief on the
phone (_"You committed to March metrics — they never arrived."_), a
teammate plays the manager Dana, and the judge wears the glasses as live
nudges land mid-sentence. Debrief memo drafted on the walk out — brief on
the way in, whisper in the room, memo in your pocket.

Fallback ladder if hardware fights back: scripted sequence on the
`/glasses` page (same cards, same pacing) → canned push to whatever M6
render channel works → live.

## Why it wins on the rubric

- **Understands you** — the nudges are grounded in your forwarded thread,
  your claims, your rehearsed weak points; not generic negotiation tips.
- **Adaptability** — one card contract, many surfaces: web preview, macOS
  notification, HTTP sink, adb broadcast, on-device APK. Phone↔glasses
  handoff is the architecture, not a demo trick.
- **Ergonomics** — one line of green text, ≥10-second auto-clear, zero
  interaction required; the UI is "keep looking at them."
- **Works on glasses** — [fill in after hardware: which channel, what it
  rendered, latency observed].
- **Impact** — the surface generalizes: any consequential conversation
  where looking away costs you (depositions, interviews, board Q&A).

## Tech stack

LangGraph + FastAPI (agent), Next.js/CopilotKit AG-UI (surfaces + relay),
Mastra Scout agent, AgentMail + Exa (ingestion), Neon Postgres (memory),
Kotlin/Android (M6 viewer), stdlib Python (sinks/relay).

## Repo

github.com/udirobert/mettle — whisper channel: `docs/WORN_M6.md`,
`backend/graph/whisper.py`, `frontend/src/app/api/glasses/`,
`scripts/glasses_*.py`, `glasses-android/`.
