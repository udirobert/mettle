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
- **Scout agent** — a Mastra agent (`scout/`) that reads the inbox, calls the
  ingestion and research routes, and writes `scout_log` events into shared
  state over AG-UI. A Mastra workflow wraps it in a durable approval gate.
- **Shared contract** — `backend/graph/state.py` is the single source of truth;
  `use-conversation-state.ts` mirrors it typed.
- **Frontend** — Next.js + CopilotKit. `/webmcp` exposes all four phases as
  browser-native agent tools via `document.modelContext`, so an in-browser agent
  can prepare, rehearse, support, and debrief without leaving the tab.

## Sponsor usage

Each sponsor does a job Mettle cannot do without. File paths point to the code.

### Neon — the persistent brain

- **Why it's necessary:** a counsel agent that forgets your last conversation
  with Dana is a chatbot. Memory, graph checkpoints, and Scout's suspended
  approvals must survive restarts, and every model call needs one credential.
- **Postgres:** `backend/context/memory.py` keeps a `counterpart_memory` table
  (commitments, changed assumptions, notes per counterpart), read at ingest and
  written at debrief. `backend/graph/checkpoint.py` runs the LangGraph
  `PostgresSaver` on the same database. Mastra persists Scout's working memory,
  workflow snapshots, and trace spans there too (`scout/src/mastra/storage.ts`).
- **AI Gateway:** Scout's model is `neon/claude-sonnet-4-6` through the gateway
  (`scout/src/mastra/models.ts`). One key, one bill, switchable per model.
- **Honest notes:** the gateway's OpenAI Responses path fails on multi-step tool
  runs, so tool-calling agents use a Claude model. `infra/neon/neon.ts` declares
  the gateway as code.

### Mastra — the Scout, with a human gate it can't skip

- **Why it's necessary:** Scout works before you arrive, and what it finds must
  wait for you. A Mastra workflow `suspend()`s with the draft brief and resumes
  only when you decide — minutes or hours later, even after a server restart.
- **How:** `briefing` = `gather → approval (suspend) → release`
  (`scout/src/mastra/workflows/briefing.ts`). `POST /scout/brief` starts it;
  `POST /scout/brief/:runId/decision` resumes it from a fresh process, loading
  the snapshot from Neon. Rejecting discards the draft and nothing reaches the
  Coach. We killed the server mid-approval and resumed to prove it.
- **Agent:** `scout/src/mastra/agents/scout-agent.ts` calls the ingestion and
  research routes and appends auditable `ScoutEvent`s to per-thread working
  memory, streamed to the UI as AG-UI `STATE_SNAPSHOT`/`STATE_DELTA`.
- **Observability:** every run writes a trace to Neon via the storage exporter
  with sensitive data filtered.
- **Honest notes:** a deterministic, LLM-free Scout (`POST /scout/run`) returns
  the same events, so the demo never depends on a model being up.

### AgentMail — the agent's own inbox

- **Why it's necessary:** the wow moment is forwarding Dana's thread to your
  agent. It needs its own address, and only reads mail sent to it.
- **How:** `backend/context/agentmail_client.py` polls `messages.list` (no
  webhook, no public URL — it survives venue wifi) and sends the debrief memo
  from the agent's address. `ingestion.py` normalizes threads into claims.
- **Honest notes:** without a key, ingestion falls back to a bundled seed thread
  and labels it `(sample thread)` in the scout log. It never passes it off as
  your mail.

### Exa — public homework

- **Why it's necessary:** your position means little without the market. Exa
  finds comp bands and company context that your inbox can't.
- **How:** `backend/context/research_client.py` returns claims with
  `provenance="web"` and the source URLs, into the same keep/reject gate.
- **Honest notes:** without a key, research returns empty with `degraded: true`
  and Scout logs the step as `skipped` rather than inventing sources.

### Featherless — the fallback model

- **Why it's necessary:** a demo should not die with one provider. Scout lists
  Featherless (`moonshotai/Kimi-K2-Instruct-0905`) after the Neon gateway and
  Mastra falls through on error.
- **How:** `scout/src/mastra/models.ts` builds the list from whichever keys are
  present. We ran the full Scout on Featherless alone and got the same log.

### What a judge can check in two minutes

1. `curl :4111/scout/status` → `{"storage":"neon"}`.
2. `curl -X POST :4111/scout/brief` → `awaiting_approval` with the draft.
3. Restart the Scout server, then
   `curl -X POST :4111/scout/brief/<runId>/decision -d '{"approved":true}'` →
   `released`. The decision survived the restart.

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
