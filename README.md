# Mettle

An agent for high-stakes conversations in four phases: Coach, Opponent,
Wingman, and Debrief.

The demo wedge is one consequential event — Elena Park, $40M LP renewal —
with progressive disclosure: Coach and Rehearse first; Live and Debrief as
later rooms. Evidence is paste → claim-level keep/reject → debate.

## Repository map

- `backend/graph/state.py` is the shared LangGraph state contract. Both owners
  must add fields there, never in mode-local schemas.
- `backend/graph/opponent.py` and `backend/graph/wingman_reactive.py` belong to
  Person A.
- `backend/graph/coach.py`, `backend/graph/context.py`,
  `backend/graph/wingman_proactive.py`, `backend/graph/debrief.py`,
  `backend/triggers/rules.py`, and `backend/voice/` belong to Person B.
- `scenarios/lp_renewal.md` is the first vertical-slice scenario (default demo).
- `frontend/` is the CopilotKit Next.js surface. The workspace in
  `frontend/src/app/page.tsx` composes `CoachPanel`, `OpponentChat`,
  `WingmanSidePanel`, and `DebriefView` around a phase rail and signal desk.
  `frontend/src/hooks/use-conversation-state.ts` is the typed wrapper around
  CopilotKit's shared agent state and mirrors `state.py`.
- `frontend/src/components/coach-panel.tsx` — claim-level HITL + staged council
  (perspectives land, then agreed / split / move).
- `frontend/src/fixtures/lp-event.ts` — Elena Park default event.
- `frontend/src/lib/extract-evidence.ts` + `api/extract-context/` — paste-path
  claim extraction (agent `/extract-context` with local fallback).
- `frontend/src/components/nudge-card.tsx`, `a2ui-catalog.tsx`, and
  `a2ui-nudge-host.tsx` render the proactive nudge surface.
- `docs/NORTH_STAR.md` defines the product vision: a stakes-aware calendar and
  live counsel layer, not a generic meeting assistant.
- `docs/CONTEXT_INGESTION.md` defines paste-path HITL now and planned
  Composio/Exa ingestion later.

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

## Deploy

The production frontend is at `https://mettle-xi.vercel.app` and is linked to
this GitHub repository. Pushing to `main` autodeploys. The WebMCP demo page is at
`https://mettle-xi.vercel.app/webmcp`.

### Backend

Current backend is deployed on Modal at `https://ungethe--mettle-agent.modal.run`.

Backend (Modal):

```bash
modal deploy modal_app.py
```

Set `OPENAI_API_KEY` as a Modal secret if you want LLM-backed output; otherwise
the endpoints fall back to deterministic output.

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
- **Done (shared)** — restraint pass after user feedback: time-based entry
  (Minutes / Hours / Days), walk-in card as the standard output, a single
  "Show working" disclosure on the brief, visual artefacts (raise bar, pattern
  dots) and sequenced motion in place of explanatory copy. Principles in
  `docs/NORTH_STAR.md` → Restraint.
- **Next (Person B)** — real context ingestion (Gmail/Calendar OAuth + public
  research). Paste HITL remains the unscalable path that teaches the contract.
- **Stretch** — LiveKit voice adapter. Additive — the demo is complete without it.
- **Product north star** — calendar-native high-stakes conversation flow. See
  `docs/NORTH_STAR.md` before making major frontend changes.

## Build order

1. **Done** — graph skeleton + state contract + scenario + frontend shells.
2. **Done (Person B)** — Coach stress-test + proactive nudge enrichment.
3. **Done (Person A)** — reactive Wingman + opponent roleplay + debrief.
4. **Done (shared)** — nudge surface + SignalDesk + reactive pre-fill.
5. **Done (Person B)** — multi-perspective Coach + paste claim-level HITL +
   progressive disclosure demo wedge.
6. **Next (Person B)** — real context ingestion (Composio / Exa / Firecrawl).
7. **Stretch (Person B)** — LiveKit voice adapter.

## Known gaps

- **Context ingestion** — paste + deterministic extract is the demo path. Real
  OAuth/Composio/Exa/Firecrawl retrieval is future work.
- **A2UI action forwarding** — the "Get a reframe" action is handled locally in
  the UI. It is not yet forwarded to the agent as an `a2uiAction`.
- **LiveKit voice** — typed turns are the supported input path.

## Upstream

This project was bootstrapped from CopilotKit's maintained
`examples/integrations/langgraph-python` template. The legacy standalone
`coagents-starter` and `coagents-travel` repositories have been consolidated
into the CopilotKit examples monorepo.
