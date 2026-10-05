# Scout (Lane C)

Mastra agent that prepares the brief before a consequential conversation. It
calls Lane A's `/context/import` and `/context/research`, and mirrors an
auditable `scout_log` into shared AG-UI state via Mastra working memory
(`@ag-ui/mastra` turns working-memory changes into `STATE_SNAPSHOT`/`STATE_DELTA`).

Note: the adapter package is `@ag-ui/mastra` (not `@mastra/agui`).

## Run

```bash
cd scout
NODE_ENV=development npm i --include=dev   # NODE_ENV=production skips dev deps
OPENAI_API_KEY=... npm run dev             # Studio + API on :4111
```

| Env                                                  | Default                            | Purpose                                                            |
| ---------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `BACKEND_URL`                                        | `http://localhost:8123`            | Lane A FastAPI service                                             |
| `SCOUT_MODEL`                                        | auto (see below)                   | Optional explicit primary model (any Mastra model string)          |
| `FEATHERLESS_API_KEY`                                | —                                  | Enables Featherless (open models) as fallback, or primary if alone |
| `FEATHERLESS_MODEL`                                  | `moonshotai/Kimi-K2-Instruct-0905` | Any id from `api.featherless.ai/v1/models`                         |
| `NEON_AI_GATEWAY_TOKEN` / `NEON_AI_GATEWAY_BASE_URL` | —                                  | Neon AI Gateway credentials (Mastra reads them for `neon/<model>`) |
| `SCOUT_DB_URL`                                       | `file:./scout.db`                  | Scout working-memory store                                         |
| `SCOUT_CORS_ORIGIN`                                  | `http://localhost:3000`            | Comma-separated origins                                            |
| `PORT`                                               | `4111`                             |                                                                    |

## Durable approval gate

`briefing` workflow: `gather → approval (suspend) → release`. Scout drafts;
the user decides. The suspended snapshot is stored in Mastra storage (Neon when
`DATABASE_URL` is set), so a decision works from a fresh process.

```bash
curl :4111/scout/status                                   # {"storage":"neon"|"local"}
curl -X POST :4111/scout/brief                            # -> status: awaiting_approval, runId
curl -X POST :4111/scout/brief/<runId>/decision \
     -H 'Content-Type: application/json' -d '{"approved":true}'   # -> done, released
```

Verified on Neon: start, kill the server, restart, approve → `released: true`;
reject → `released: false` with a `discarded_brief` event; bad body → 400. Trace
spans and the workflow snapshot land in `mastra_ai_spans` /
`mastra_workflow_snapshot`. Mastra creates its own `mastra_*` tables on first
boot (about 45), separate from Mettle's `counterpart_memory`.

## Model selection and fallback

`src/mastra/models.ts` builds the agent's model list from whatever is
configured, in order: `SCOUT_MODEL` or Neon (`neon/claude-sonnet-4-6`) →
Featherless → OpenAI direct. Mastra falls through to the next entry when a
model errors. Neon + Featherless both set = Neon primary, Featherless fallback.
Verified: a broken primary falls through to the next model; with Neon and
Featherless both set the agent resolves `neon/claude-sonnet-4-6` then
`featherless-ai/moonshotai/Kimi-K2-Instruct-0905`; with Featherless alone a full
AG-UI run completes both tool calls and streams a correct 3-entry `scout_log`.
Not yet observed: an actual Neon→Featherless failover during a live run.

Dev note: the first `mastra dev` boot can sit on "Preparing development
environment" for 1-2 minutes. If a second instance refuses to start, kill the
old one and `rm -rf scout/.mastra`.

## LLM: Neon AI Gateway

Enabled on the `mettle` Neon project (`billowing-hill-98356084`, branch `main`)
via `infra/neon/neon.ts`. To get credentials on a new machine:

```bash
cd infra/neon && neon env pull --project-id billowing-hill-98356084 -s ai-gateway --file .env.gateway
# copy NEON_AI_GATEWAY_TOKEN + NEON_AI_GATEWAY_BASE_URL into scout/.env, plus:
# SCOUT_MODEL=neon/claude-sonnet-4-6
```

Use a **Claude** model. `neon/gpt-5-mini` makes the first tool call but the
gateway returns `400 Bad Request` on the follow-up step (OpenAI Responses
reasoning replay). `neon/claude-sonnet-4-6` completes multi-step tool runs.

Verified: typechecks; `mastra dev` boots; agent `scout` registered;
`/copilotkit/info` responds; a full AG-UI run (`POST /copilotkit`,
`method: agent/run`) streams `STATE_SNAPSHOT`/`STATE_DELTA` carrying `scout_log`
with real timestamps. Working memory is per-thread, so use a fresh `threadId`
per briefing.

## Frontend wiring (merge window 2 only — `api/copilotkit/[[...slug]]/route.ts`)

The 4111 `/copilotkit` route is a full CopilotKit runtime, so don't point an
`HttpAgent` at it. Use the AG-UI adapter's remote-agent helper instead:

```ts
import { MastraClient } from "@mastra/client-js";
import { MastraAgent } from "@ag-ui/mastra";

const scoutUrl = process.env.SCOUT_URL || "http://localhost:4111";
const scoutAgents = await MastraAgent.getRemoteAgents({
  mastraClient: new MastraClient({ baseUrl: scoutUrl }),
  resourceId: "scout",
});

const runtime = new CopilotRuntime({
  agents: { default: defaultAgent, ...scoutAgents }, // key: "scout"
  ...
});
```

Needs `@mastra/client-js` and `@ag-ui/mastra` in `frontend/package.json`.
If the fetch fails at boot, wrap in try/catch and omit the scout agent.

## 90-minute cut line

If this isn't streaming `scout_log` by the checkpoint, drop it: Lane A's poll
endpoint is the scout and writes the same `ScoutEvent` shape. Nothing else
depends on this directory.
