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
cd backend && python -m pytest tests/ -v
```

## Current scope

Graph wiring, reactive interrupt, deterministic proactive triggers, LP renewal
scenario loading, and frontend phase-panel shells are in place. Node bodies
carry explicit TODOs with ownership markers. All 5 backend tests pass.
LiveKit is an unimplemented seam until text-mode Wingman is stable.

## Build order

1. **Done** — graph skeleton + state contract + scenario + frontend shells,
   all stubbed. Proven wiring, no LLM logic yet.
2. **Person A** fills in `wingman_reactive.py` + `opponent.py`; **Person B**
   fills in `coach.py` + `wingman_proactive.py` escalation, against the same
   state schema and `lp_renewal.md`. Text/typed input only.
3. **Person B** layers in `voice/livekit_adapter.py` so Wingman can run against
   a real or simulated live call. Additive — the demo is complete without it.

## Known gaps

- Docker deployment files reference the pre-rename `agent/` directory; local
  dev is unaffected.
- A2UI catalog still carries starter demo components; replace with nudge-specific
  generative UI when the Wingman proactive surface matures.

## Upstream

This project was bootstrapped from CopilotKit's maintained
`examples/integrations/langgraph-python` template. The legacy standalone
`coagents-starter` and `coagents-travel` repositories have been consolidated
into the CopilotKit examples monorepo.
