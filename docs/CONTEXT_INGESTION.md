# Context Ingestion Plan

This is the plan for adding private context and public research to Mettle
without turning the product into an always-on inbox scanner or a free-roaming
browser agent. The goal is to make Coach sharper and Wingman more grounded
before important conversations.

## Product Position

Use Composio as a context-ingestion primitive, not as a conversation-time
dependency. Mettle should ask the user to import bounded context for a specific
conversation, extract an evidence brief, and require explicit approval before
that brief enters the LangGraph state.

Use public web tools the same way: evidence retrieval first, agent reasoning
second. The product should not let the model browse whenever it feels uncertain.
Instead, Mettle should run scoped research, extract source-backed claims, and
show the user what will influence the conversation plan.

This matters because high-stakes conversation prep needs source-backed facts:
prior commitments, numbers already conceded, objections raised in earlier
emails, relationship history, and dates. It should not silently summarize a
user's entire mailbox.

## Initial Scope

Start with Gmail and Calendar. Add Outlook, Slack, Notion, and Drive only after
the first import flow proves useful.

The first version should support:

- Import by sender/domain, thread, keyword, or date range.
- Preview of extracted claims before they affect Coach or Wingman.
- User approval of the final context brief.
- Source references back to the original message or calendar event.
- Redaction of obviously sensitive unrelated content.

Do not use Composio triggers for live Wingman yet. The documented Gmail trigger
path is polling-based, which is fine for inbox workflows but not the latency
profile for a live call. Live transcript ingestion should still come from typed
turns first, then LiveKit.

## Public Research Layer

Use public research tools after private context, not before it. Private context
answers "what happened between these people?" Public research answers "what
external facts should change how we prepare?"

Suggested provider roles:

- `Exa`: default semantic search for people, firms, companies, markets, news,
  research, and financial reports. Use it when the input is a question or a
  topic and the system needs ranked sources.
- `Firecrawl`: known-URL extraction, site crawl, PDF parsing, and clean markdown
  from specific pages. Use it when the user or Exa has already identified the
  source.
- `Tinyfish`: browser-like workflows and rendered-page automation. Use later
  for complex collection tasks that require interaction, not for the first
  evidence layer.

Examples:

- Founder pitch: investor's latest theses, portfolio overlaps, public comments,
  recent fund news, and known contrarian views.
- LP renewal: pension plan allocation changes, consultant memos if public,
  recent GP/strategy commentary, and market context for the weak point.
- Board update: company news, competitor moves, regulatory shifts, and public
  benchmark data.
- Salary negotiation: company comp philosophy, recent layoffs, market salary
  ranges, and role benchmarks.

During live Wingman, avoid open-ended public browsing. It is too slow and too
risky for high-stakes moments. Wingman should rely on the approved brief,
current transcript, and deterministic trigger rules. If the user explicitly asks
for a quick lookup, handle it as a reactive action and label the answer as
external research.

## UX Flow

### Demo path (shipped)

1. User opens the Elena Park LP renewal event.
2. User pastes (or loads a sample) correspondence with Elena.
3. Backend/local extract proposes source-backed claims (`decision: pending`).
4. UI shows each claim with Keep / Reject.
5. User debates with only kept claims → brief `status: approved` enters shared
   state and Coach runs (`coach_perspectives` → `coach_synthesize`).
6. User can re-debate with the same kept brief anytime.

Nothing reaches Coach prompts until claims are kept and the brief is approved.

### Later path (OAuth / research)

1. User chooses the scenario and clicks `Import context`.
2. User connects Gmail or Calendar through hosted OAuth.
3. User scopes the import:
   - Person or organization.
   - Date range.
   - Optional keywords such as `renewal`, `allocation`, `fee`, `board`, or
     `extension`.
4. Backend fetches matching items and creates an evidence brief.
5. UI shows the brief with source-backed claims (same Keep / Reject gate).
6. User approves, edits, or discards the brief.
7. Approved brief becomes part of the shared conversation state.

The UI should make the import feel like due diligence, not magic. The strongest
screen is a clean evidence table: claim, source, confidence, and why it matters.

## State Contract

Shipped in `backend/graph/state.py` (and mirrored on the frontend).

```python
class EvidenceClaim(TypedDict):
    claim: str
    source_ids: list[str]
    confidence: Literal["low", "medium", "high"]
    relevance: Literal[
        "stakes",
        "counterpart",
        "objection",
        "commitment",
        "number",
        "timeline",
        "market",
        "company",
        "person",
        "risk",
    ]
    decision: NotRequired[Literal["pending", "approved", "rejected"]]


class ContextBrief(TypedDict):
    status: Literal["empty", "draft", "approved", "rejected"]
    sources: list[ContextSource]
    claims: list[EvidenceClaim]
    counterpart_history: list[str]
    open_commitments: list[str]
    sensitive_redactions: list[str]
    user_approved_at: str | None
```

Also on `ConversationState`:

```python
context_brief: NotRequired[ContextBrief]
coach_stage: NotRequired[Literal["idle", "debating", "perspectives", "ready"]]
```

Coach reads only kept claims when `status == "approved"`. Opponent can use
approved counterpart history to stay in character. Wingman can use approved
commitments and numbers to detect risky concessions. Debrief can compare what
happened on the call against prior commitments.

## Backend Shape

Keep the Composio integration server-side.

Suggested files:

```text
backend/context/
  composio_client.py      # auth/session helpers and provider calls
  research_client.py      # Exa/Firecrawl/Tinyfish wrappers
  ingestion.py            # fetch bounded records and normalize sources
  brief.py                # extract EvidenceClaim + ContextBrief
  safety.py               # prompt-injection filtering and redaction
```

The first pass can be a FastAPI route outside the graph:

- `POST /context/connect` starts hosted OAuth.
- `POST /context/import` fetches bounded records.
- `POST /context/research` runs scoped public research.
- `POST /context/brief` creates a draft brief.
- `POST /context/approve` writes the approved brief into graph state.

Do not add raw email bodies directly to `ConversationState`. Store the approved
brief and source references. If raw source text must be retained, keep it in a
separate short-lived store with a TTL.

## Security Rules

- Request read-only scopes first.
- Do not request send-email scopes for this feature.
- Treat imported email and docs as untrusted input.
- Strip or quarantine instructions aimed at the agent, such as requests to
  ignore previous instructions or reveal hidden prompts.
- Never let imported content override system prompts, owner instructions, or
  the user's stated goal.
- Show the user what will be used before it affects the graph.
- Support disconnect and deletion of connected accounts.
- Cite public sources for public research claims.
- Do not blend public and private evidence without labeling the source type.
- Do not let a public search result override private commitments or user-stated
  facts unless the conflict is surfaced explicitly.

## Demo Path

Do not block the current demo on Composio.

### Near-term demo (shipped)

Paste-path HITL replaces one-click fixtures for the LP renewal wedge:

- User pastes Elena correspondence (or the sample thread).
- Deterministic extract proposes claims (`decision: pending`).
- User Keep / Rejects each claim; debate runs only on kept claims.
- Coach council stages perspectives then synthesis; re-debate reuses the brief.

Legacy static fixtures in `frontend/src/fixtures/evidence-fixtures.ts` may still
exist for research-shaped claims; do not depend on fixture-click as the primary
demo path.

### Later: OAuth + public research

When adding providers, keep the same claim-level gate. Example claim shapes:

- Prior email: Elena flagged DPI and fee drag.
- Prior commitment: user promised a portfolio-construction memo before renewal.
- Prior number: LP allocation under discussion is `$40M`.
- Public context: LPs are scrutinizing DPI and distributions more heavily.

## Implementation Order

1. **Done** — `ContextBrief` state + paste extract + claim Keep/Reject + Coach grounding.
2. **Done** — staged Coach council consumes approved claims.
3. Add Exa for scoped public search (still claim-gated).
4. Add Firecrawl for known-URL extraction and PDF/source cleanup.
5. Add server-side Composio auth for Gmail only.
6. Add bounded import and draft-brief generation (same HITL UI).
7. Feed approved commitments and numbers into proactive Wingman rules.
8. Add Calendar.
9. Consider Tinyfish only for browser workflows that search/scrape cannot
   handle.
10. Revisit triggers only for asynchronous prep reminders, not live transcript
    nudges.
