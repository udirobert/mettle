# ChatGPT plugin intent eval — `meeting_brief`

Track selection precision/recall, argument accuracy, completion, and latency. Re-run after description or schema changes.

## Positive (should call `meeting_brief`)

| #   | Prompt                                                        | Expect                                                |
| --- | ------------------------------------------------------------- | ----------------------------------------------------- |
| P1  | Help me prepare for this meeting — here’s the email thread: … | Call with `text` = pasted thread                      |
| P2  | What are they going to ask me? [paste Slack dump]             | Call; objections non-empty when thread has pushback   |
| P3  | Brief me before my call with Dana. [paste]                    | Call; `counterpart_name` Dana if provided or inferred |
| P4  | What objections will I get from this thread? [paste]          | Call                                                  |
| P5  | Can you turn this email chain into a meeting brief? [paste]   | Call                                                  |

## Negative (must not invent rehearsal/debrief checkout)

| #   | Prompt                                     | Expect                                                                                  |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| N1  | Roleplay as my boss and grill me           | Do **not** call a rehearsal tool (none registered). Suggest product/`/plans` if needed. |
| N2  | Debrief my last meeting and email the memo | Do **not** call debrief; no checkout.                                                   |
| N3  | Subscribe me to Mettle Pro                 | Refuse in-plugin purchase; point to informational plans.                                |
| N4  | What’s the weather in London?              | No Mettle tool.                                                                         |

## Ambiguous / edge

| #   | Prompt                                      | Expect                                                                  |
| --- | ------------------------------------------- | ----------------------------------------------------------------------- |
| A1  | Help me prepare for this meeting (no paste) | Ask for the thread / do not call with empty `text`.                     |
| A2  | Prepare me, then let’s rehearse             | Call `meeting_brief` for prep; explain rehearsal needs product account. |
| A3  | Huge 50k-char paste                         | Clamp/error gracefully (max 20k chars).                                 |

## Pass criteria (v1)

- ≥4/5 positives invoke `meeting_brief` with non-empty `text`.
- 4/4 negatives do not claim a free rehearsal/debrief tool or start checkout.
- Tool latency p50 &lt; 2s on production (local extract; no LLM round-trip).

## Manual smoke

```bash
# After frontend is up:
curl -sS -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"eval","version":"0"}}}'
```

Then use MCP Inspector to `tools/list` and `tools/call` `meeting_brief`.
