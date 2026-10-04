# Context Ingestion Plan

How private context and public research reach Mettle's evidence brief without
turning the product into an always-on inbox scanner or a free-roaming browser
agent. The goal is a Coach that is sharper and a Wingman that is grounded —
with the user approving every claim before it influences the plan.

## Product Position

The agent has its own inbox. Ingestion is _invitation-based_: the user forwards
a thread to the agent's AgentMail address (or pastes one directly). A Scout
agent watches the inbox, reads what was deliberately sent to it, and prepares a
draft evidence brief. Nothing is scanned continuously; the agent only reads
mail addressed to it.

Public research follows the same rule: scoped retrieval first, agent reasoning
second. The Scout runs bounded Exa searches on the counterpart and stakes,
extracts source-backed claims, and shows the user what will influence the
conversation plan — never open-ended browsing whenever the model feels
uncertain.

This matters because high-stakes personal conversations need source-backed
facts: prior commitments, numbers already conceded, objections raised in
earlier emails, relationship history, dates. And because these are personal
conversations, the approve-before-use gate is a product promise, not a
checkbox.

## Ingestion Sources (ranked)

1. **Forward a thread → AgentMail.** The user forwards a correspondence to the
   agent's own address (e.g. `mettle@agentmail.to`). Inbound mail arrives via
   AgentMail webhook or `messages.list` polling. This is the primary path and
   the front door of the product.
2. **Paste → `/extract-context`.** Existing deterministic extract; the offline
   fallback and the no-credentials demo path.
3. **Scenario fixtures.** Pre-authored events for instant demos.

## The Scout Agent

The Scout is a separate, lightweight agent (Mastra, exposed over AG-UI
`@ag-ui/mastra`) that owns pre-arrival work:

- Watches the AgentMail inbox for forwarded threads.
- Detects the counterpart, stakes, and conversation type; creates or updates
  the docket event.
- Feeds thread text into `/extract-context` to produce claims
  (`decision: pending`).
- Runs scoped Exa research (`exa.search(..., contents={"highlights": True})`)
  on the counterpart, organization, and stakes; emits research claims with
  public source references.
- Reads remembered history for repeat counterparts (Neon Postgres).
- Emits a **Scout log** — an auditable record of what it did — to the UI.

The Scout never writes an approved brief. It drafts; the user approves. The
main LangGraph `conversation_agent` owns Coach/Opponent/Wingman/Debrief; the
two agents run side by side in the CopilotKit runtime.

## Public Research Layer (Exa)

Private context answers "what happened between these people?" Public research
answers "what external facts should change how we prepare?"

Exa is the default research provider: semantic search for people, companies,
markets, norms, and benchmarks. Recommended call: `search` with `auto` type
and `contents={"highlights": True}`.

Examples:

- Salary negotiation: company comp philosophy, market salary bands, recent
  layoffs or funding, the counterpart's public comments on hiring/pay.
- Landlord dispute: local tenant-rights rules, small-claims norms, comparable
  deposit disputes.
- Co-founder reset: market benchmarks for roles/equity, public signals about
  company trajectory.

During live Wingman, no open-ended browsing — too slow and too risky. Wingman
relies on the approved brief, the transcript, and deterministic trigger rules.
An explicit user ask for a lookup is a reactive action, labeled as external
research.

## UX Flow

### Forward path (primary)

1. User forwards a thread to the agent's AgentMail address.
2. Scout detects the message, drafts a docket event (counterpart, stakes,
   conversation type).
3. Scout extracts claims + runs Exa research → draft `ContextBrief` with all
   claims `decision: pending` and provenance labeled (`inbox` / `web`).
4. Scout log in the UI reports what happened: "Read your thread with Dana —
   9 claims · 3 public sources · 1 remembered commitment."
5. User keeps/rejects each claim → brief `status: approved` enters shared
   state → Coach council runs (`coach_perspectives` → `coach_synthesize`).
6. Re-debate reuses the kept brief.

### Paste path (fallback, shipped)

Identical from step 3: deterministic extract proposes claims, claim-level
Keep/Reject, approved brief grounds the council.

Nothing reaches Coach prompts until claims are kept and the brief is approved.

## State Contract

`backend/graph/state.py` — unchanged shape, extended semantics:

```python
class EvidenceClaim(TypedDict):
    claim: str
    source_ids: list[str]
    confidence: Literal["low", "medium", "high"]
    relevance: Literal[
        "stakes", "counterpart", "objection", "commitment",
        "number", "timeline", "market", "company", "person", "risk",
    ]
    provenance: NotRequired[Literal["inbox", "paste", "web", "memory", "stated"]]
    decision: NotRequired[Literal["pending", "approved", "rejected"]]
```

`ContextBrief` stays as shipped; sources distinguish AgentMail message IDs
from pasted text and Exa result URLs.

New Scout-visible state (proposed, add to `state.py` when built):

```python
scout_log: NotRequired[list[ScoutEvent]]       # auditable agent actions
agent_inbox_address: NotRequired[str]          # the agent's AgentMail address
counterpart_history_ref: NotRequired[str]      # pointer into Neon memory
```

## Backend Shape

```text
backend/context/
  agentmail_client.py   # inbox provisioning, message fetch/send
  scout_bridge.py       # handoff between Mastra scout and graph state
  research_client.py    # Exa wrapper (scoped queries → claims)
  ingestion.py          # normalize forwarded threads into sources
  memory.py             # counterpart history via Neon Postgres
  safety.py             # prompt-injection filtering and redaction
```

Routes:

- `POST /context/import` — pull latest inbox messages → draft event + brief.
- `POST /context/research` — scoped Exa run → research claims.
- `POST /context/brief` — create draft brief.
- `POST /context/approve` — write approved brief into graph state.
- `POST /debrief/memo` — send the debrief memo via AgentMail.

Do not store raw email bodies in `ConversationState`. Store the approved brief
and source references; keep raw thread text in a short-lived store with a TTL.

## Memory (Neon Postgres)

`checkpoint.py` already reads `DATABASE_URL` into `PostgresSaver`. Extend the
same database for counterpart memory:

- After Debrief, persist commitments, changed assumptions, and next actions
  keyed by counterpart.
- On new ingest for a known counterpart, surface remembered history as
  `provenance: "memory"` claims — still behind the same approval gate.

## LLM Provider (Neon AI Gateway)

All model calls route through `graph/llm.py`, which already honors
`OPENAI_BASE_URL`. Neon AI Gateway is OpenAI-compatible:

```bash
OPENAI_API_KEY=$NEON_AI_GATEWAY_TOKEN          # nt_live_...
OPENAI_BASE_URL=${NEON_AI_GATEWAY_BASE_URL}/v1 # append /v1 to the bare host
OPENAI_MODEL=gpt-5-mini
```

No code changes; every council perspective, enrichment, and debrief call goes
through the gateway.

## Security Rules

- The agent reads only mail addressed to its own inbox — no OAuth access to
  the user's mailbox, ever.
- Treat forwarded email and web results as untrusted input.
- Strip or quarantine instructions aimed at the agent (prompt injection).
- Never let imported content override system prompts, owner instructions, or
  the user's stated goal.
- Show the user what will be used before it affects the graph.
- Label provenance; never silently blend inbox, web, memory, and stated facts.
- Do not let public research override private commitments or user-stated
  facts unless the conflict is surfaced explicitly.
- Cite public sources for public research claims.
- Support revoking the inbox and deleting retained thread text.

## Demo Path

1. Open the app: the docket shows `Salary review with Dana` — created because
   the user forwarded the thread to `mettle@agentmail.to`.
2. Scout log: "Read your thread with Dana — 9 claims · 3 public sources on
   Meridian comp bands · 1 remembered commitment."
3. Claim gate with provenance labels → approve → council debates.
4. Rehearse against Dana's persona (built from the real thread + research).
5. Live: pocket wingman, typed fragments, one nudge at a time.
6. Debrief: memo arrives in the user's inbox, sent from the agent's own
   address. The commitments are remembered for the next conversation.

## Implementation Order

1. **Done** — `ContextBrief` state + paste extract + claim Keep/Reject +
   Coach grounding.
2. **Done** — staged Coach council consumes approved claims.
3. Neon AI Gateway env swap (`OPENAI_BASE_URL`) + Neon Postgres checkpointer
   (`DATABASE_URL`).
4. AgentMail inbox + `/context/import` polling → draft event + claims.
5. Exa `research_client.py` → research claims into the same gate.
6. Scout log UI surface + `provenance` labels on claims.
7. Debrief memo send via AgentMail (`/debrief/memo`).
8. Mastra Scout agent over AG-UI, registered beside `conversation_agent` —
   takes over inbox watch + triage from the FastAPI route.
9. Counterpart memory read/write via Neon Postgres.
10. Stretch: Executor MCP gateway in front of AgentMail/Exa calls; Assistant
    UI components for chat surfaces; Fly sprites for sandboxed tool runs.
