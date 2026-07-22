# Mettle

An agent for high-stakes conversations in four phases: Coach, Opponent,
Wingman, and Debrief.

## Repository map

- `backend/graph/state.py` is the shared LangGraph state contract. Both owners
  must add fields there, never in mode-local schemas.
- `backend/graph/wingman_reactive.py` and `backend/graph/opponent.py` belong to
  Person A.
- `backend/graph/coach.py`, `backend/graph/wingman_proactive.py`,
  `backend/triggers/rules.py`, and `backend/voice/` belong to Person B.
- `scenarios/lp_renewal.md` is the first vertical-slice scenario.
- `frontend/` is the CopilotKit Next.js surface. The phase panels
  (`CoachPanel`, `OpponentChat`, `WingmanSidePanel`, `DebriefView`) are committed
  as shells; `frontend/src/hooks/use-conversation-state.ts` is the typed wrapper
  around CopilotKit's shared agent state and mirrors `state.py`.
- `WingmanSidePanel` renders both reactive replies (Person A) and proactive
  nudge cards (Person B) from the same shared state.
- `docs/CONTEXT_INGESTION.md` defines the planned Composio/email import path:
  private import and public research -> evidence brief -> user approval ->
  shared state.

## Run

```bash
cd frontend
npm install
npm run dev
```

The frontend starts Next.js and the local LangGraph deployment at port `8123`.
Set the required provider credentials in `.env` before adding LLM-backed node
logic. The graph ID is `conversation_agent`.

## Test

```bash
cd backend && uv run python -m pytest tests/ -v
```

## Current scope

- **Done** — graph wiring, reactive interrupt, deterministic proactive triggers,
  LP renewal scenario loading, frontend phase-panel shells.
- **Done (Person B)** — Coach LLM stress-test (structured output: blind spots,
  concrete moves, likely objections, opening strategy) + proactive nudge
  enrichment (rules pass → LLM, context-aware). Both with graceful fallback.
  11 tests passing.
- **In progress (Person A)** — reactive Wingman answer + opponent roleplay.
- **Next (Person B)** — multi-perspective Coach debate (Skeptic + Counterpart +
  Voss Negotiator → synthesis) + Debrief. See CLAUDE.md for design.
- **Stretch** — LiveKit voice adapter. Additive — the demo is complete without it.
- **Later** — context ingestion for Gmail/Calendar plus public research via
  Exa/Firecrawl/Tinyfish-style providers. Start with static evidence fixtures
  for demos; do not block the core graph on OAuth or browsing.

## Build order

1. **Done** — graph skeleton + state contract + scenario + frontend shells.
2. **Done (Person B)** — Coach LLM stress-test + proactive nudge enrichment.
3. **In progress (Person A)** — reactive Wingman + opponent roleplay.
4. **Next (Person B)** — multi-perspective Coach debate + Debrief.
5. **Stretch (Person B)** — LiveKit voice adapter.

## Known gaps

- `opponent.py`, `wingman_reactive.py` (answer function), and `debrief.py`
  still return placeholder text with TODOs — Person A's work items.
- A2UI demo catalog was removed; nudge-specific generative UI components
  should be added when the Wingman proactive surface matures.

## Upstream

This project was bootstrapped from CopilotKit's maintained
`examples/integrations/langgraph-python` template. The legacy standalone
`coagents-starter` and `coagents-travel` repositories have been consolidated
into the CopilotKit examples monorepo.
