# Parallel Work Plan

This is the working agreement for the two-person vertical slice. It is designed
to minimize merge conflicts while preserving one end-to-end graph.

## Branches

| Owner    | Suggested branch            | Primary files                                                           |
| -------- | --------------------------- | ----------------------------------------------------------------------- |
| Person A | `feature/reactive-opponent` | `opponent.py`, `wingman_reactive.py`, reactive UI                       |
| Person B | `feature/proactive-coach`   | `coach.py`, `wingman_proactive.py`, `triggers/`, `voice/`, proactive UI |

Pull `main` before changing any shared file. Keep each commit focused on one
mode or one integration boundary.

## Shared State Change Protocol

1. Post the proposed field name, type, producer, and consumers before editing
   `backend/graph/state.py`.
2. One person adds the field in a small dedicated commit.
3. Both branches rebase or merge that commit before relying on the field.
4. Do not use untyped dictionary keys as a shortcut around the contract.

## First Milestones

### Person A: Reactive and Opponent (Done)

- Replace the deterministic reply in `answer_reactive_query` with a concise
  answer grounded in the scenario, counterpart profile, latest transcript, and
  Coach weak points. ✅
- Preserve `wait_for_reactive_query` as the sole interrupt boundary. ✅
- Make `run_opponent` produce a skeptical persona-conditioned rehearsal turn. ✅
- Render the reactive response distinctly from a proactive nudge. ✅

### Person B: Coach and Proactive (Done)

- Make `run_coach` extract stakes, counterpart profile, and weak points from
  `lp_renewal.md` before introducing an LLM. ✅
- Add cheap rules to `evaluate_latest_turn` for repetition, overlong monologue,
  and concession language. Keep the newest-turn-only and rate-limit behavior. ✅
- Define a nudge card model and render it in the Wingman panel and SignalDesk. ✅
- Emit the nudge as an AG-UI `a2ui-surface` activity message and render it
  through `A2UINudgeHost`. ✅
- Add the LiveKit adapter only after text transcript updates trigger nudges. 🔄

## Definition of the First Demo

1. Coach fills the scenario context and surfaces concrete weak points. ✅
2. Opponent stays in Elena Park's character through a typed rehearsal. ✅
3. A typed reactive question pauses and resumes the LangGraph graph, then shows
   a short answer. ✅
4. Pasting a user transcript turn produces at most one rate-limited proactive
   nudge; when an LLM key is present it is enriched with context. ✅
5. The latest nudge renders as an A2UI surface in the Wingman panel and the
   SignalDesk, with a "Get a reframe" action that pre-fills the reactive prompt. ✅
6. Debrief reads the accumulated transcript and nudges. ✅
7. Context import uses static fixtures to preview and approve an evidence brief
   before it enters shared state. ✅

## Avoid These Conflicts

- Do not both edit `graph.py` for node-local behavior. Keep node logic within
  the owner file; request a shared-graph change only for routing or lifecycle.
- Do not overhaul `frontend/src/app/page.tsx` in parallel. Add mode components
  under `frontend/src/components/` and coordinate one composition change.
- Do not add LiveKit dependencies or voice lifecycle code to reactive work.
- Do not change the scenario's facts to make an answer easier. Add a new
  scenario file for a new vertical.
