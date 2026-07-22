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

## Test

```bash
cd backend && uv run python -m pytest tests/ -v
```

## Current scope

- **Done** — graph wiring, reactive interrupt, deterministic proactive triggers,
  LP renewal scenario loading, frontend phase-panel shells.
- **Done (Person A)** — Coach scenario resolution (custom scenario synthesized
  from a typed description or voice interview, LP renewal as the default) +
  weak-point stress test. Opponent voice rehearsal (Deepgram Voice Agent,
  echo-cancellation-safe) and typed fallback, both against the resolved
  scenario. Debrief analysis (outcome, commitments including accidental soft
  promises, open objections, weak-point verdicts, follow-up email draft).
- **Done (Person B)** — Coach multi-perspective debate synthesis (Skeptic,
  Counterpart, Voss Negotiator → structured `CoachAnalysis`) + proactive nudge
  enrichment (rules pass → LLM, context-aware). Both with graceful fallback.
- **In progress (Person B)** — reactive Wingman answer.
- **Stretch (Person B)** — LiveKit voice adapter for the live call. Additive —
  the demo is complete without it.

## Build order

1. **Done** — graph skeleton + state contract + scenario + frontend shells.
2. **Done (Person A)** — Coach scenario resolution + stress test, Opponent
   voice + typed rehearsal, Debrief analysis.
3. **Done (Person B)** — Coach multi-perspective debate, proactive nudge
   enrichment.
4. **In progress (Person B)** — reactive Wingman answer.
5. **Stretch (Person B)** — LiveKit voice adapter for the live call. Additive —
   the demo is complete without it.

## Known gaps

- `wingman_reactive.py` (answer function) still returns placeholder text —
  Person B's work item.
- A2UI demo catalog was removed; nudge-specific generative UI components
  should be added when the Wingman proactive surface matures.

## Upstream

This project was bootstrapped from CopilotKit's maintained
`examples/integrations/langgraph-python` template. The legacy standalone
`coagents-starter` and `coagents-travel` repositories have been consolidated
into the CopilotKit examples monorepo.
