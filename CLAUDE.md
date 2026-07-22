# Mettle Collaboration Guide

Mettle prepares, rehearses, and supports high-stakes conversations. The four
graph phases are `prep`, `rehearsal`, `live`, and `debrief`.

## Start Here

1. Read `README.md` and `docs/COLLABORATION.md`.
2. Treat `backend/graph/state.py` as the single state contract.
3. Read `scenarios/lp_renewal.md` before changing behavior.
4. Keep the text-only flow working; LiveKit is additive and must not block it.

## Ownership

**Person A: reactive**

- `backend/graph/opponent.py`
- `backend/graph/wingman_reactive.py`
- Reactive sections of the frontend, including quick-question UI and replies

**Person B: proactive**

- `backend/graph/coach.py`
- `backend/graph/wingman_proactive.py`
- `backend/triggers/rules.py`
- `backend/voice/`
- Proactive nudge UI and Coach UI

Shared files require coordination before changing them:

- `backend/graph/state.py`
- `backend/graph/graph.py`
- `frontend/src/app/api/copilotkit/[[...slug]]/route.ts`
- `frontend/src/app/page.tsx`

## Non-Negotiable Contracts

- Add every cross-phase state field to `ConversationState`; do not create a
  second TypedDict for a mode.
- Preserve the phase literals exactly: `prep`, `rehearsal`, `live`, `debrief`.
- `transcript` is append-only conversation evidence. Never mutate existing
  turns in place.
- A proactive nudge must be low-noise: run deterministic rules first, only use
  an LLM after a candidate fires, and rate-limit repeated nudge kinds.
- Reactive Wingman must use LangGraph's `interrupt`/resume pattern. It should
  return a short tactical answer, not a general coaching essay.
- Opponent responses must stay in the counterpart persona and remain skeptical.
- LiveKit must consume the same `ConversationState`; it is not a parallel graph.

## Development

```bash
cd frontend
npm install
npm run dev
```

The Next.js UI runs on port 3000 and LangGraph runs on port 8123. The graph ID
is `conversation_agent`.

Before committing backend changes, run:

```bash
python3 -m compileall -q backend
```

Do not replace the CopilotKit transport or alter the generated skills under
`.agents/skills` unless the task is explicitly a CopilotKit integration update.
