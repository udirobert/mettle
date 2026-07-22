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
- `frontend/` is the CopilotKit Next.js surface; it still carries the upstream
  starter UI while the phase panels are implemented.

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
pass, and LP renewal state contract are committed first. LiveKit is deliberately
an unimplemented adapter seam until text-mode Wingman is stable.

## Upstream

This project was bootstrapped from CopilotKit's maintained
`examples/integrations/langgraph-python` template. The legacy standalone
`coagents-starter` and `coagents-travel` repositories have been consolidated
into the CopilotKit examples monorepo.
