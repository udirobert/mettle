# Mettle — High-Stakes Conversation Agent

## Purpose

An agent for high-stakes conversations people can't afford to get wrong — a
founder pitching a skeptical investor, a fund manager in an LP renewal meeting,
a rough board update. The agent operates in four phases:

- **Coach** — prepares the user before the conversation (stress-tests position,
  surfaces blind spots, gives concrete moves).
- **Opponent** — roleplays the other side for rehearsal, in character, not as a
  friendly sparring partner.
- **Wingman (reactive)** — supports the user during the real conversation; user
  types a fragment, gets a fast targeted response.
- **Wingman (proactive)** — watches the live transcript, surfaces nudges
  unprompted when a pattern is worth flagging (repetition, long monologue,
  conceded number), rate-limited to avoid noise.
- **Debrief** — post-conversation summary.

## Architecture

Flat project with a Next.js frontend in `frontend/` and a Python LangGraph
backend in `backend/`. CopilotKit (CoAgents / AG-UI) shares the graph's state
live with the React UI.

```
/backend
  /graph
    state.py              # shared LangGraph state schema — the contract
    coach.py              # Coach node — Person A
    opponent.py           # Opponent node — Person A
    wingman_reactive.py   # reactive Wingman nodes (interrupt + answer) — Person B
    wingman_proactive.py  # proactive trigger evaluation — Person B
    debrief.py            # post-conversation node — Person A
    graph.py              # top-level phase router wiring all nodes
  /triggers
    rules.py              # deterministic proactive nudge rules — Person B
  /voice
    livekit_adapter.py    # LiveKit LLMAdapter seam — stretch goal, Person B
  main.py                 # LangGraph server entrypoint (graph id: conversation_agent)
  langgraph.json
/frontend
  /src
    /app
      page.tsx            # phase switcher + CopilotChat side panel
      layout.tsx          # CopilotKit provider wiring
      api/copilotkit/     # CopilotKit runtime route → LangGraph agent
    /components
      coach-panel.tsx          # Coach UI shell — Person B
      opponent-chat.tsx        # Opponent rehearsal UI shell — Person A
      wingman-side-panel.tsx   # reactive replies (A) + proactive nudge cards (B)
      debrief-view.tsx         # debrief UI shell
    /hooks
      use-conversation-state.ts  # typed wrapper around CopilotKit shared state
/scenarios
  lp_renewal.md           # first vertical-slice demo scenario
```

## Key Pattern: Shared State as the Contract

`backend/graph/state.py` defines `ConversationState` — the single LangGraph
state object every node reads from and writes to. This is what lets Coach's prep
context carry into Wingman, and the live transcript feed straight into Debrief.

```python
class ConversationState(TypedDict):
    scenario_id: str
    stakes: str
    counterpart_profile: dict
    user_weak_points: list[str]
    transcript: list[TranscriptTurn]
    nudges_sent: list[Nudge]
    open_reactive_query: str | None
    phase: Literal["prep", "rehearsal", "live", "debrief"]
    reactive_reply: NotRequired[str | None]
    debrief_notes: NotRequired[list[str]]
```

The frontend mirrors this shape in
`frontend/src/hooks/use-conversation-state.ts` and reads/writes via CopilotKit's
`useAgent()` hook (`agent.state` / `agent.setState()`). Do not duplicate state in
component-local state.

## Interrupt Points

- **Reactive Wingman**: `wait_for_reactive_query` uses LangGraph's native
  `interrupt()` to pause until the UI resumes with the user's quick question,
  then `answer_reactive_query` produces the response.
- **Proactive Wingman**: a cheap rules-based pass (`triggers/rules.py`) runs
  against new transcript turns — no LLM call per turn. LLM escalation is a
  future addition only when a candidate pattern fires.

## Team Split

- **Person A (before + after)**: `coach.py`, `opponent.py`, `debrief.py`, and
  their UI panels (`coach-panel.tsx`, `opponent-chat.tsx`, `debrief-view.tsx`).
- **Person B (during)**: `wingman_reactive.py`, `wingman_proactive.py`,
  `triggers/rules.py`, both sections of `wingman-side-panel.tsx`, and the voice
  integration for the live call once the core graph is stable.

Both work against the same `state.py` contract and `scenarios/lp_renewal.md`.

## Development

```bash
cd frontend
npm install        # also runs setup-agent (uv sync in backend/)
npm run dev        # Next.js (3000) + LangGraph dev server (8123)
```

Set provider credentials in `.env` before adding LLM-backed node logic.

## Tech Stack

- **Frontend**: Next.js 16, React 19, TailwindCSS 4, CopilotKit v2
- **Backend**: LangGraph (Python), LangGraph Platform dev server
- **Transport**: AG-UI protocol via CopilotKit runtime
- **Voice (stretch)**: LiveKit LLMAdapter — additive, not blocking

## Build Order

1. Graph skeleton + state contract + scenario + frontend shells, all stubbed
   (this commit).
2. Person A fills coach + opponent + debrief; Person B fills reactive +
   proactive escalation — text/typed input only.
3. Voice layers on additively — the demo is complete without it. Person B keeps
   the LiveKit adapter for live-call Wingman voice; Person A owns rehearsal
   voice (Opponent) as a separate seam.
