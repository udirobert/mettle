# Mettle

The personal agent for the conversations you can't afford to get wrong —
five modes: Scout, Coach, Opponent, Wingman, and Debrief.

The demo wedge is one personal-life event — a salary negotiation with your
manager — with progressive disclosure: Coach and Rehearse first; Live and
Debrief as later rooms. Evidence enters via the agent's own inbox (forward a
thread), paste, or scenario fixtures → claim-level keep/reject → debate.
The agent does its own homework (Exa research), remembers your last hard
conversation (Neon Postgres), and emails you the debrief (AgentMail).

## Repository map

- `backend/graph/state.py` is the shared LangGraph state contract. Both owners
  must add fields there, never in mode-local schemas.
- `backend/graph/opponent.py` and `backend/graph/wingman_reactive.py` belong to
  Person A.
- `backend/graph/coach.py`, `backend/graph/context.py`,
  `backend/graph/wingman_proactive.py`, `backend/graph/debrief.py`,
  `backend/context/` (AgentMail/Exa/memory ingestion), `backend/triggers/rules.py`,
  and `backend/voice/` belong to Person B. `/scout` (Mastra agent,
  AG-UI; see `scout/README.md`) also belongs to Person B.
- `scenarios/salary_review.md` is the demo scenario (planned);
  `scenarios/lp_renewal.md` remains as contrast.
- `frontend/` is the CopilotKit Next.js surface. The workspace in
  `frontend/src/app/page.tsx` composes `CoachPanel`, `OpponentChat`,
  `WingmanSidePanel`, and `DebriefView` around a phase rail and signal desk.
  `frontend/src/hooks/use-conversation-state.ts` is the typed wrapper around
  CopilotKit's shared agent state and mirrors `state.py`.
- `frontend/src/components/coach-panel.tsx` — claim-level HITL + staged council
  (perspectives land, then agreed / split / move).
- `frontend/src/fixtures/salary-event.ts` — Dana salary-review default event
  (planned); `lp-event.ts` stays as contrast.
- `frontend/src/lib/extract-evidence.ts` + `api/extract-context/` — paste-path
  claim extraction (agent `/extract-context` with local fallback).
- `frontend/src/components/nudge-card.tsx`, `a2ui-catalog.tsx`, and
  `a2ui-nudge-host.tsx` render the proactive nudge surface.
- `docs/NORTH_STAR.md` defines the product vision: the personal agent for
  conversations you can't afford to get wrong — an agent with its own inbox,
  homework, and memory — not a meeting assistant or life-admin tool.
- `docs/CONTEXT_INGESTION.md` defines AgentMail forward-path + paste HITL now,
  and the Mastra Scout + Exa research + Neon memory build-out.

## WebMCP

The `/webmcp` page exposes Mettle's four conversation phases as browser-native
agent tools. The page registers six tools with `document.modelContext`:

- `mettle_get_event` — load stakes and counterpart profile
- `mettle_extract_context` — extract claims from pasted email/thread
- `mettle_run_coach` — multi-perspective Coach debate (Skeptic + Elena +
  Negotiator)
- `mettle_rehearse_opponent` — in-character skeptical response
- `mettle_ask_wingman` — quick tactical reply for a live moment
- `mettle_run_debrief` — commitments, open objections, and next actions

The tool `execute` handlers call `/api/webmcp/*`, which proxies to the same
LangGraph functions used by the CopilotKit UI. This lets the in-browser agent
prepare, rehearse, support, and debrief a conversation without leaving the tab.

To test locally with Chrome, enable `chrome://flags/#enable-webmcp-testing` and
open `http://localhost:3000/webmcp`. ChatGPT's in-app browser supports WebMCP
out of the box.

## ChatGPT plugin — "help me prepare for this meeting"

Remote **Streamable HTTP MCP** at [`/mcp`](https://mettle-xi.vercel.app/mcp) (production: `https://mettle-xi.vercel.app/mcp`) for ChatGPT directory and mid-conversation discovery — not only browser WebMCP.

Free v1 tool: `meeting_brief` — paste thread → evidence brief + likely objections. Descriptions use user words ("help me prepare for this meeting", "what are they going to ask me") and say when **not** to use. Rehearsal/debrief stay out of the free ChatGPT set; they live in the product for existing accounts or via the informational [plans](https://mettle-xi.vercel.app/plans) page — **not** in-plugin checkout (OpenAI allows plugin commerce for physical goods only).

- Connect: [docs/CHATGPT_PLUGIN_CONNECT.md](docs/CHATGPT_PLUGIN_CONNECT.md)
- Eval: [docs/CHATGPT_PLUGIN_EVAL.md](docs/CHATGPT_PLUGIN_EVAL.md)
- Starter prompts: [docs/CHATGPT_PLUGIN_STARTER_PROMPTS.md](docs/CHATGPT_PLUGIN_STARTER_PROMPTS.md)
- Playbook: [docs/CHATGPT_PLUGIN_PLAYBOOK.md](docs/CHATGPT_PLUGIN_PLAYBOOK.md)

## Deploy

The production frontend is at `https://mettle-xi.vercel.app` and is linked to
this GitHub repository. Pushing to `main` autodeploys. The WebMCP demo page is at
`https://mettle-xi.vercel.app/webmcp`. The public ChatGPT MCP endpoint is at
`https://mettle-xi.vercel.app/mcp`.

### Backend

Current backend is deployed on Modal at `https://ungethe--mettle-agent.modal.run`.

Backend (Modal):

```bash
modal deploy modal_app.py
```

Set `OPENAI_API_KEY` as a Modal secret if you want LLM-backed output; otherwise
the endpoints fall back to deterministic output. For Neon AI Gateway, also set
`OPENAI_BASE_URL` to `<NEON_AI_GATEWAY_BASE_URL>/v1` and `OPENAI_MODEL`
(e.g. `gpt-5-mini`), plus `DATABASE_URL` for the Postgres checkpointer. In
`.env`, quote the Neon URL (`DATABASE_URL="postgresql://…&…"`) — the `&` breaks
shell sourcing otherwise. For tool-calling agents (the Scout) use a Claude
model on the gateway; `gpt-5-mini` fails on multi-step tool runs there.

Scout (Mastra, `scout/`): `cd scout && NODE_ENV=development npm i --include=dev
&& npm run dev` serves on `:4111`. Needs `NEON_AI_GATEWAY_TOKEN` +
`NEON_AI_GATEWAY_BASE_URL` and/or `FEATHERLESS_API_KEY` in `scout/.env`.

Backend (Render):

```bash
render blueprint apply render.yaml
```

Set `OPENAI_API_KEY` and `CORS_ALLOWED_ORIGINS` in the Render dashboard. If no
OpenAI key is set, every endpoint falls back to deterministic output.

### Frontend (Vercel)

Pushing to `main` autodeploys to `mettle-xi.vercel.app`. In the Vercel project
dashboard, set `AGENT_URL` to the deployed backend URL (for example
`https://ungethe--mettle-agent.modal.run`). For local development, copy
`frontend/.env.example` to `frontend/.env` and leave `AGENT_URL` as
`http://localhost:8123`.

## Run

```bash
cd frontend
npm install
npm run install:agent   # explicit: uv sync in backend/
npm run dev
```

The frontend starts Next.js on port `3000` and the local AG-UI endpoint
(`backend/serve.py`) on port `8123`. `npm run dev:agent` uses uvicorn + FastAPI
with `LangGraphAGUIAgent` instead of `langgraph-cli dev`.

Set the required provider credentials in `.env` before adding LLM-backed node
logic. The graph ID is `conversation_agent`.

## Test

```bash
cd backend && uv run python -m pytest tests/ -q
```

Frontend build:

```bash
cd frontend
npx tsc --noEmit
npm run build
```

## Current scope

- **Done** — graph wiring, reactive interrupt, deterministic proactive triggers,
  LP renewal scenario loading, frontend phase-panel shells.
- **Done (Person B)** — multi-perspective Coach debate (Skeptic + Counterpart +
  Voss Negotiator → synthesis), staged across `coach_perspectives` →
  `coach_synthesize` so the UI can show the council forming. Proactive nudge
  enrichment (rules → LLM) with graceful fallback.
- **Done (Person A)** — reactive Wingman interrupt/answer + opponent roleplay +
  debrief.
- **Done (shared)** — kind-aware nudge cards, progressive disclosure across
  Coach / Rehearse / Live / Debrief (judgment first, inventory folded).
- **Done (Person B)** — paste-path evidence: extract claims, keep/reject per
  claim, debate only with kept claims; re-debate anytime.
- **Done (shared)** — follow-up memo from Debrief (`mailto` + copy) and
  shareable council split from Coach (copy / anonymized; no transcript).
- **Now** — personal-agent reposition: Neon AI Gateway + Postgres, salary
  scenario, AgentMail inbox ingestion, Exa research, Mastra Scout agent,
  debrief memo by email, counterpart memory.
- **Stretch** — Executor MCP gateway, Assistant UI surfaces, Fly sprites,
  LiveKit voice. Additive — the demo is complete without them.
- **Product north star** — the personal agent for conversations you can't
  afford to get wrong. See `docs/NORTH_STAR.md` before making major frontend
  changes.

## Build order

1. **Done** — graph skeleton + state contract + scenario + frontend shells.
2. **Done (Person B)** — Coach stress-test + proactive nudge enrichment.
3. **Done (Person A)** — reactive Wingman + opponent roleplay + debrief.
4. **Done (shared)** — nudge surface + SignalDesk + reactive pre-fill.
5. **Done (Person B)** — multi-perspective Coach + paste claim-level HITL +
   progressive disclosure demo wedge.
6. **Now (hackathon reposition)** — Neon AI Gateway + Postgres envs → salary
   scenario → AgentMail inbox ingestion → Exa research → scout log +
   provenance → AgentMail debrief memo → Mastra Scout (AG-UI) → counterpart
   memory.
7. **Stretch** — Executor MCP gateway, Assistant UI, Fly sprites, LiveKit.

## Known gaps

- **Scout agent (Mastra)** — built in `scout/`, streaming `scout_log` over
  AG-UI (Neon AI Gateway primary, Featherless fallback), registered in the
  CopilotKit runtime via `MastraAgent.getRemoteAgents`. A durable `briefing`
  workflow suspends for user approval on Neon-backed snapshots. The
  deterministic `POST /scout/run` remains the demo-safe fallback. See
  `scout/README.md`.
- **Counterpart memory** — `backend/context/memory.py` persists to Neon and is
  wired into ingest and debrief; `run_debrief` splits commitments from notes so
  remembered commitments surface as `provenance="memory"` claims.
- **A2UI action forwarding** — the "Get a reframe" action is handled locally in
  the UI. It is not yet forwarded to the agent as an `a2uiAction`.
- **LiveKit voice** — typed turns are the supported input path.

## Upstream

This project was bootstrapped from CopilotKit's maintained
`examples/integrations/langgraph-python` template. The legacy standalone
`coagents-starter` and `coagents-travel` repositories have been consolidated
into the CopilotKit examples monorepo.
