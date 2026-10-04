# Mettle — the personal agent for the conversations you can't afford to get wrong

## The ask

An event description joked about an agent that manages your relationships — "ok
maybe not that one." We built that one.

Not a meeting assistant. Not a life-admin tool. A personal agent with its own
inbox, its own homework, and a memory of your last hard conversation — pointed at
the one conversation you keep putting off.

## The demo wedge

A salary review with your manager on Thursday. $185k base and the senior title,
deferred twice already. The title is winnable. The cash is above band, two peers
filed comp complaints last cycle, and you promised March metrics you never sent.

## What it does

**It has its own inbox.** Forward the thread to the agent's AgentMail address.
It polls, reads, and normalizes the thread into claims. No webhook, no public URL
— it works on venue wifi.

**It does its own homework.** Exa research on comp bands and public comp data
lands as claims with `provenance="web"`.

**It remembers.** A counterpart-history table in Postgres: commitments made,
assumptions held, who they were and what they said last time.

**You decide what it sees.** Every claim arrives `decision:"pending"` with a
provenance badge — inbox / web / memory / paste / stated. You keep or reject
each one. The Coach council only cites claims you approved.

**It attacks your position.** A three-seat adversarial council — a Skeptic, your
counterpart in character, and a Negotiator — surfaces the disagreement instead of
averaging it away.

**It supports you live, then closes the record.** A wingman flags the concession
before you make it. The debrief pulls commitments and open items, and the agent
emails you the memo from its own address.

## Architecture

Two agents, one shared state contract.

- **Counsel agent** — LangGraph, five modes (Scout / Coach / Opponent /
  Wingman / Debrief), served over AG-UI.
- **Scout agent** — watches the inbox, triages, calls the ingestion and research
  routes, writes `scout_log` events into shared state.
- **Shared contract** — `backend/graph/state.py` is the single source of truth;
  `use-conversation-state.ts` mirrors it typed.
- **Frontend** — Next.js + CopilotKit. `/webmcp` exposes all four phases as
  browser-native agent tools via `document.modelContext`, so an in-browser agent
  can prepare, rehearse, support, and debrief without leaving the tab.

## Graceful degradation is a feature

Every external integration returns `None`/empty without credentials, and every
route answers **200 with `{"degraded": true}`** — never a 500. Each rung of the
build is a complete, demoable product:

1. Existing app + scenario + paste path — zero risk
2. - Neon AI Gateway LLM + Postgres checkpointer
3. - Exa research claims in the gate
4. - AgentMail inbox ingestion + debrief memo by email
5. - Mastra Scout + scout log + counterpart memory

We ship the top rung that works at submission time.

## Try it

- App: `https://mettle-xi.vercel.app`
- WebMCP tools: `https://mettle-xi.vercel.app/webmcp`

The demo wedge runs with **no credentials at all** — the seeded thread, the
scenario, and the council all work offline.

## What we'd build next

- Move the deterministic extractor behind an LLM pass for messy real threads.
- Counterpart memory as a real timeline view, not a log line.
- Multi-round negotiation rehearsal that carries state across sessions.
