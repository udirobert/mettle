# Mettle — High-Stakes Conversation Agent

## Purpose

Mettle is a stakes-aware calendar and live counsel layer for conversations
people can't afford to get wrong — a founder pitching a skeptical investor, a
fund manager in an LP renewal meeting, a rough board update.

See `docs/NORTH_STAR.md` before making major product or frontend changes. Mettle
should not be positioned as a generic AI meeting assistant, meeting-notes tool,
or chat interface. The product starts from consequential calendar events and
moves the user through brief, pressure test, rehearsal, live support, and
debrief.

The **demo wedge** is one event: Elena Park / $40M LP renewal. Progressive
disclosure: Coach and Rehearse are primary; Live and Debrief are later rooms.

The agent operates in four phases:

- **Coach** — adversarial council (Skeptic, Counterpart, Negotiator) then
  synthesis that surfaces disagreement; grounded only in human-kept claims.
- **Opponent** — roleplays the other side for rehearsal, in character, not as a
  friendly sparring partner.
- **Wingman (reactive)** — supports the user during the real conversation; user
  types a fragment, gets a fast targeted response.
- **Wingman (proactive)** — watches the live transcript, surfaces nudges
  unprompted when a pattern is worth flagging (repetition, long monologue,
  conceded number), rate-limited to avoid noise.
- **Debrief** — post-conversation summary of commitments, changed assumptions,
  and next actions.

## Architecture

Flat project with a Next.js frontend in `frontend/` and a Python LangGraph
backend in `backend/`. CopilotKit (CoAgents / AG-UI) shares the graph's state
live with the React UI.

```
/backend
  /graph
    state.py              # shared LangGraph state schema — the contract
    scenarios.py          # deterministic scenario loader (lp_renewal)
    context.py            # paste → draft evidence brief (deterministic extract)
    coach.py              # Coach council — perspectives then synthesize — Person B
    opponent.py           # Opponent node — Person A
    wingman_reactive.py   # reactive Wingman nodes (interrupt + answer) — Person A
    wingman_proactive.py  # proactive trigger evaluation + A2UI surface emit — Person B
    debrief.py            # post-conversation node
    graph.py              # top-level phase router wiring all nodes
  /triggers
    rules.py              # deterministic proactive nudge rules — Person B
  /voice
    livekit_adapter.py    # LiveKit LLMAdapter seam — stretch goal, Person B
  /tests                  # pytest specs — run with: python -m pytest
  main.py                 # LangGraph server entrypoint (graph id: conversation_agent)
  serve.py                # local FastAPI AG-UI endpoint + /extract-context
  server_config.py        # CORS / environment guards
  langgraph.json
/frontend
  /src
    /app
      page.tsx            # Elena-first event list + phase rail (Coach/Rehearse now;
                          # Live/Debrief later) + slim signal desk
      layout.tsx          # CopilotKit provider wiring
      api/copilotkit/     # CopilotKit runtime route → HttpAgent
      api/extract-context/# paste extract proxy → agent /extract-context
    /components
      coach-panel.tsx          # claim HITL + staged council — Person B
      opponent-chat.tsx        # Opponent rehearsal — Person A
      wingman-side-panel.tsx   # one intervention hero; transcript folded
      debrief-view.tsx         # next move hero; record folded
      event-list.tsx           # Elena Park hero; other events as contrast
      nudge-card.tsx           # kind-aware nudge card (panel + signal variants)
      a2ui-catalog.tsx         # A2UI catalog definition for NudgeCard
      a2ui-nudge-host.tsx      # consume AG-UI a2ui-surface messages
      ui/                      # reusable shadcn primitives
    /fixtures
      lp-event.ts              # default Elena Park event
      evidence-fixtures.ts     # legacy static research fixtures
    /lib
      extract-evidence.ts      # local paste extract fallback
      share-artifacts.ts       # council split + follow-up memo (no transcript)
    /hooks
      use-conversation-state.ts  # typed wrapper around CopilotKit shared state
      use-theme.tsx
/scenarios
  lp_renewal.md           # first vertical-slice demo scenario
```

## Testing

```bash
cd backend && uv run python -m pytest tests/ -q
```

90 tests pass. `test_coach.py` covers scenario loading, debate fields, and the
perspectives→synthesize stage; `test_context.py` covers paste extract, claim
decisions, and evidence grounding; `test_proactive.py` covers trigger rules,
ingestion, enrichment fallback, and A2UI emit.

Frontend type-check and build:

```bash
cd frontend
npx tsc --noEmit
npm run build
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
    awaiting_reactive_query: bool
    phase: Literal["prep", "rehearsal", "live", "debrief"]
    reactive_reply: NotRequired[str | None]
    reactive_query_prefill: NotRequired[str | None]
    debrief_notes: NotRequired[list[str]]
    coach_analysis: NotRequired[CoachAnalysis]
    coach_stage: NotRequired[Literal["idle", "debating", "perspectives", "ready"]]
    context_brief: NotRequired[ContextBrief]
```

`EvidenceClaim` includes `decision: pending | approved | rejected`. Coach prompts
only receive kept claims after the brief `status` is `approved`.

The frontend mirrors this shape in
`frontend/src/hooks/use-conversation-state.ts` and reads/writes via CopilotKit's
`useAgent()` hook (`agent.state` / `agent.setState()`). Do not duplicate state in
component-local state.

## Interrupt Points

- **Reactive Wingman**: `wait_for_reactive_query` uses LangGraph's native
  `interrupt()` to pause until the UI resumes with the user's quick question,
  then `answer_reactive_query` produces the response. The UI can pre-fill the
  reactive prompt from a proactive nudge's "Get a reframe" action.
- **Proactive Wingman**: two-stage pipeline — cheap rules pass
  (`triggers/rules.py`, no LLM per turn) → LLM enrichment only when a candidate
  nudge fires. Enrichment reads `coach_analysis` and `counterpart_profile` to
  produce context-aware nudge text. Falls back to rules message on any error.
  The nudge is emitted as an AG-UI `a2ui-surface` activity message via
  `copilotkit.a2ui` and rendered through `A2UINudgeHost` / `NudgeCard`.
- **Coach claim gate (HITL)**: paste extract proposes claims; the user keep/rejects
  each claim; only then does `runCoach` write an approved brief and run the
  council. Re-debate reuses the kept brief.

## LLM Integration

All LLM calls go through `backend/graph/llm.py` (`get_llm()`), which returns
`None` when no `OPENAI_API_KEY` is set. Every call site wraps invocations in
try/except with deterministic fallback — the graph never crashes because the
LLM is unavailable. Model is configurable via `OPENAI_MODEL` (default: gpt-4o).

**Coach** (`coach.py`): graph nodes `coach_perspectives` → `coach_synthesize`.
Three adversarial perspectives run in parallel (`llm.batch`), then synthesis
produces structured `CoachAnalysis` (blind spots, moves, objections, opening
strategy, perspectives, disagreements, consensus). Partial analysis lands in
state after perspectives so the UI can stage empty seats → lenses →
agreed/split/move. Falls back to `FALLBACK_ANALYSIS` on any error. Approved
evidence from `context_brief` is injected into perspective prompts.

**Context** (`context.py`): deterministic paste extract (no LLM required).
`POST /extract-context` on `serve.py`; frontend proxies via
`/api/extract-context` with a local fallback.

**Opponent** (`opponent.py`): produces an in-character counterpart turn for
rehearsal, conditioned on the scenario profile and recent transcript. Falls back
to a skeptical, evidence-seeking reply.

**Proactive** (`wingman_proactive.py`): rules pass detects candidate nudges,
then LLM enrichment replaces the generic message with context-aware advice
(max 2 sentences, references the specific turn and counterpart concerns).
Falls back to rules message on any error.

**Debrief** (`debrief.py`): reads the full transcript and nudges to produce
commitments, changed assumptions, and next actions.

## Team Split

- **Person A (reactive + opponent)**: `wingman_reactive.py`, `opponent.py`,
  `wingman-side-panel.tsx` reactive flow.
- **Person B (proactive + coach + context)**: `coach.py`, `context.py`,
  `wingman_proactive.py`, `triggers/rules.py`, Coach/evidence UI, proactive
  nudge UI, and the LiveKit integration once the core graph is stable.

Both work against the same `state.py` contract and `scenarios/lp_renewal.md`.

## Development

```bash
cd frontend
npm install        # also runs setup-agent (uv sync in backend/)
npm run dev        # Next.js (3000) + AG-UI endpoint via serve.py (8123)
```

`npm run dev:agent` now runs `backend/serve.py` (uvicorn + FastAPI + LangGraphAGUIAgent)
instead of `langgraph-cli dev`. The `HttpAgent` in `api/copilotkit/[[...slug]]/route.ts`
points at `http://localhost:8123/`.

Set provider credentials in `.env` before adding LLM-backed node logic.

## Tech Stack

- **Frontend**: Next.js 16, React 19, TailwindCSS 4, CopilotKit v2
- **Backend**: LangGraph (Python), FastAPI/uvicorn via `serve.py`
- **Transport**: AG-UI protocol via CopilotKit runtime
- **Voice (stretch)**: LiveKit LLMAdapter — additive, not blocking

## Build Order

1. **Done** — graph skeleton + state contract + scenario + frontend shells.
2. **Done (Person B)** — Coach stress-test + proactive nudge enrichment
   with graceful fallback.
3. **Done (Person A)** — reactive Wingman interrupt/answer + opponent roleplay
   - debrief.
4. **Done (shared)** — kind-aware nudge cards, A2UI generative nudge surface,
   reactive prompt pre-fill from "Get a reframe".
5. **Done (Person B)** — multi-perspective Coach debate (staged graph + UI) +
   paste claim-level HITL + progressive disclosure across phases + shareable
   council split and debrief follow-up memo.
6. **Next (Person B)** — real context ingestion (see below).
7. **Stretch (Person B)** — LiveKit voice adapter. Additive — the demo is
   complete without it.

## Multi-Perspective Coach Debate (shipped)

The Coach phase has time budget — the user is preparing, not in the moment.
This is where multiple adversarial perspectives earn their cost. Wingman (live)
is the wrong place for debate: latency matters and the two-stage rules→LLM
pipeline already provides a cheap "second perspective."

### Why not a single agent

A single LLM agent tends to anchor on one framing and toward encouragement
(because that feels helpful). Multiple perspectives force the system to
confront failure modes a single agent would miss.

### Design: three fixed adversarial perspectives + synthesis

No free-form back-and-forth rounds. Three parallel perspectives, then one
synthesis pass — all in Coach where latency is acceptable.

1. **The Skeptic** — finds the strongest argument against the position.
2. **The Counterpart (Elena)** — speaks in first person as the CIO; tests
   whether the plan survives contact with her priorities.
3. **The Negotiator (Voss)** — tactical empathy; catches the case where a
   logically perfect pitch still makes her defensive.

**Synthesis** surfaces agreement and disagreement explicitly. UI hero:
they agreed / they split / the move.

### Implementation

- Hardcoded adversarial prompts (not a generic multi-agent framework).
- Perspectives via `llm.batch`; graph stages
  `coach_perspectives` → `coach_synthesize`.
- Fallback: partial or full `FALLBACK_ANALYSIS` if LLM unavailable.
- Output is `CoachAnalysis` including `perspectives`, `disagreements`,
  `consensus`.

## Context Ingestion

See `docs/CONTEXT_INGESTION.md`.

**Now (demo):** paste thread → deterministic claim extract → per-claim
keep/reject → approved brief into shared state → Coach debate (and re-debate).

**Later:** Composio-bounded Gmail/Calendar import and Exa/Firecrawl/Tinyfish
public research, still with the same approve-before-state gate. Never an
always-on inbox scanner or free-roaming live browser.

## Known Gaps

- **Context ingestion** — paste HITL only; real OAuth/Composio/Exa/Firecrawl
  retrieval is future work.
- **A2UI action forwarding** — the "Get a reframe" action is handled locally in
  the UI (pre-fills and opens the reactive prompt). It is not yet forwarded to
  the agent as an `a2uiAction`.
- **LiveKit voice** — not wired; typed turns are the supported input path.
