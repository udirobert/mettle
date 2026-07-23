# Mettle

An agent for high-stakes conversations in four phases: Coach, Opponent,
Wingman, and Debrief.

## Repository map

- `backend/graph/state.py` is the shared LangGraph state contract. Both owners
  must add fields there, never in mode-local schemas.
- `backend/graph/opponent.py` and `backend/graph/wingman_reactive.py` belong to
  Person A.
- `backend/graph/coach.py`, `backend/graph/wingman_proactive.py`,
  `backend/graph/debrief.py`, `backend/triggers/rules.py`, and `backend/voice/`
  belong to Person B.
- `scenarios/lp_renewal.md` is the first vertical-slice scenario.
- `frontend/` is the CopilotKit Next.js surface. The workspace in
  `frontend/src/app/page.tsx` composes `CoachPanel`, `OpponentChat`,
  `WingmanSidePanel`, and `DebriefView` around a phase rail and signal desk.
  `frontend/src/hooks/use-conversation-state.ts` is the typed wrapper around
  CopilotKit's shared agent state and mirrors `state.py`.
- `frontend/src/components/nudge-card.tsx`, `a2ui-catalog.tsx`, and
  `a2ui-nudge-host.tsx` render the proactive nudge surface in both the Wingman
  side panel and the SignalDesk.
- `frontend/src/fixtures/evidence-fixtures.ts` feeds the static context-import
  demo flow.
- `docs/NORTH_STAR.md` defines the product vision: a stakes-aware calendar and
  live counsel layer, not a generic meeting assistant.
- `docs/CONTEXT_INGESTION.md` defines the planned Composio/email import path:
  private import and public research -> evidence brief -> user approval ->
  shared state.

## Run

```bash
cd frontend
npm install
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
- **Done (Person B)** — Coach LLM stress-test (structured output: blind spots,
  concrete moves, likely objections, opening strategy) + proactive nudge
  enrichment (rules pass -> LLM, context-aware). Both with graceful fallback.
- **Done (Person A)** — reactive Wingman interrupt/answer + opponent roleplay +
  debrief.
- **Done (shared)** — kind-aware nudge cards (`concession`, `long_monologue`,
  `repetition`, `timing`, `other`), A2UI generative nudge surface rendered in the
  Wingman panel and SignalDesk, and reactive prompt pre-fill from the
  "Get a reframe" action.
- **Done (Person B)** — static context-import and approval flow with evidence
  fixtures.
- **Next (Person B)** — multi-perspective Coach debate (Skeptic + Counterpart +
  Voss Negotiator -> synthesis) + real context ingestion. See CLAUDE.md for
  design.
- **Stretch** — LiveKit voice adapter. Additive — the demo is complete without it.
- **Later** — real Gmail/Calendar OAuth plus public research via
  Exa/Firecrawl/Tinyfish-style providers. Static fixtures handle the demo until
  the core graph is stable.
- **Product north star** — calendar-native high-stakes conversation flow. See
  `docs/NORTH_STAR.md` before making major frontend changes.

## Build order

1. **Done** — graph skeleton + state contract + scenario + frontend shells.
2. **Done (Person B)** — Coach LLM stress-test + proactive nudge enrichment.
3. **Done (Person A)** — reactive Wingman + opponent roleplay + debrief.
4. **Done (shared)** — A2UI nudge surface + SignalDesk integration + reactive
   pre-fill.
5. **Done (Person B)** — static context-import + approval flow.
6. **Next (Person B)** — multi-perspective Coach debate + real context ingestion.
7. **Stretch (Person B)** — LiveKit voice adapter.

## Known gaps

- **Context ingestion** — the import/approval UI uses static fixtures. Real
  OAuth/Composio/Exa/Firecrawl retrieval is future work.
- **A2UI action forwarding** — the "Get a reframe" action is handled locally in
  the UI. It is not yet forwarded to the agent as an `a2uiAction`.
- **LiveKit voice** — typed turns are the supported input path.

## Upstream

This project was bootstrapped from CopilotKit's maintained
`examples/integrations/langgraph-python` template. The legacy standalone
`coagents-starter` and `coagents-travel` repositories have been consolidated
into the CopilotKit examples monorepo.
