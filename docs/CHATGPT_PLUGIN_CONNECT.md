# Connect Mettle MCP to ChatGPT

Remote **Streamable HTTP** MCP for directory listing and mid-conversation discovery (not only browser WebMCP).

## Endpoint

| Environment | URL                                |
| ----------- | ---------------------------------- |
| Production  | `https://mettle-xi.vercel.app/mcp` |
| Local       | `http://localhost:3000/mcp`        |

Transport: `streamable-http` (stateless). No OAuth required for the free v1 tool set.

### mcp.json (Agent Plugins / submission)

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "mettle": {
      "type": "streamable-http",
      "url": "https://mettle-xi.vercel.app/mcp"
    }
  }
}
```

### Local Inspector

```bash
cd frontend && npm run dev:ui
# other terminal:
npx @modelcontextprotocol/inspector
```

Select **Streamable HTTP** → `http://localhost:3000/mcp`.

## Free tool (v1)

### `meeting_brief`

- **When to use:** user pastes a thread and says “help me prepare for this meeting”, “what are they going to ask me”, “what objections will I get”.
- **When not to use:** live coaching, rehearsal/roleplay, debrief, calendar/email send, empty paste.
- **Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false` (local extract only; no public web fetch).
- **Justification (submission portal):** read-only because it only transforms pasted text into a brief; not open-world because it does not call the public internet; not destructive because it writes nothing.

## Out of free ChatGPT set

Opponent rehearsal, Wingman, and debrief stay on:

- Browser WebMCP at `/webmcp` (demo / in-app browser), and/or
- The Mettle product for users with an **existing account**

Link users to the **informational** plans page (`/plans`) — never initiate digital checkout inside ChatGPT.

## Domain verification

When OpenAI issues a challenge token, set `OPENAI_APPS_CHALLENGE_TOKEN` on Vercel. The route `/.well-known/openai-apps-challenge` already serves that value.

## Deploy notes

1. Push/merge frontend changes so Vercel redeploys `mettle-xi`.
2. Confirm `GET/POST https://mettle-xi.vercel.app/mcp` with MCP Inspector.
3. Optional: set `NEXT_PUBLIC_METTLE_PLANS_URL` if the plans URL differs from `/plans`.
4. No Modal/backend deploy required for `meeting_brief` (runs in the Next.js route via local extract).

## Related docs

- [CHATGPT_PLUGIN_PLAYBOOK.md](./CHATGPT_PLUGIN_PLAYBOOK.md)
- [CHATGPT_PLUGIN_EVAL.md](./CHATGPT_PLUGIN_EVAL.md)
- [CHATGPT_PLUGIN_STARTER_PROMPTS.md](./CHATGPT_PLUGIN_STARTER_PROMPTS.md)
