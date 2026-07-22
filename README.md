# Mettle

An agent for high-stakes conversations in four phases: Coach, Opponent,
Wingman, and Debrief.

## Repository map

- `backend/graph/state.py` is the shared LangGraph state contract. Both owners
  must add fields there, never in mode-local schemas.
- `backend/graph/coach.py`, `backend/graph/opponent.py`, and
  `backend/graph/debrief.py` (before + after the meeting) belong to Person A.
- `backend/graph/wingman_reactive.py`, `backend/graph/wingman_proactive.py`,
  `backend/triggers/rules.py`, and `backend/voice/` (during the meeting) belong
  to Person B.
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

## Current scope

The graph wiring, native reactive interrupt, deterministic proactive trigger
pass, LP renewal state contract, and frontend phase-panel shells are committed
first. Node bodies are explicit TODOs with ownership markers. LiveKit is
deliberately an unimplemented adapter seam until text-mode Wingman is stable.

## Build order

1. **This commit** — graph skeleton + state contract + scenario + frontend
   shells, all stubbed. Proven wiring, no LLM logic yet.
2. **Person A** fills in `coach.py` + `opponent.py` + `debrief.py`; **Person B**
   fills in `wingman_reactive.py` + `wingman_proactive.py` escalation, against
   the same state schema and `lp_renewal.md`. Text/typed input only.
3. **Person B** layers in `voice/livekit_adapter.py` so Wingman can run against
   a real or simulated live call. Additive — the demo is complete without it.

## Upstream

This project was bootstrapped from CopilotKit's maintained
`examples/integrations/langgraph-python` template. The legacy standalone
`coagents-starter` and `coagents-travel` repositories have been consolidated
into the CopilotKit examples monorepo.
