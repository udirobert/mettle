import { Mastra } from "@mastra/core/mastra";
import { registerApiRoute } from "@mastra/core/server";
import { registerCopilotKit } from "@ag-ui/mastra/copilotkit";
import { MastraStorageExporter, Observability, SensitiveDataFilter } from "@mastra/observability";
import { scoutAgent } from "./agents/scout-agent";
import { briefingWorkflow } from "./workflows/briefing";
import { createScoutStorage } from "./storage";
import { runScout } from "../run-scout";
import { describeCapabilities } from "../capabilities";

export const mastra = new Mastra({
  agents: { scout: scoutAgent },
  workflows: { briefing: briefingWorkflow },
  // Neon Postgres when DATABASE_URL is set: working memory, workflow snapshots
  // (durable approvals) and trace spans all live in one place.
  storage: createScoutStorage(),
  observability: new Observability({
    configs: {
      default: {
        serviceName: "mettle-scout",
        exporters: [new MastraStorageExporter({ maxBatchWaitMs: 1000 })],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
  server: {
    port: Number(process.env.PORT ?? 4111),
    cors: {
      origin: (process.env.SCOUT_CORS_ORIGIN ?? "http://localhost:3000").split(","),
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    },
    apiRoutes: [
      registerCopilotKit({ path: "/copilotkit", resourceId: "scout" }),

      // Deterministic, LLM-free Scout: the demo-safe fallback. Returns the same
      // ScoutEvent[] the Mastra agent writes into shared state.
      registerApiRoute("/scout/run", {
        method: "POST",
        handler: async (c) => c.json({ scout_log: await runScout() }),
      }),

      // What is actually connected — lets the UI/demo say so honestly.
      registerApiRoute("/scout/status", {
        method: "GET",
        handler: async (c) => c.json(await describeCapabilities()),
      }),

      // Durable approval gate. Start a briefing: Scout gathers, then the run
      // suspends until the user decides. Returns the runId to resume later.
      registerApiRoute("/scout/brief", {
        method: "POST",
        handler: async (c) => {
          const run = await c.get("mastra").getWorkflow("briefing").createRun();
          const result = await run.start({ inputData: {} });
          return c.json(briefingResponse(run.runId, result));
        },
      }),

      // Decide on a suspended briefing. Works from a fresh process: the
      // snapshot is loaded from storage by runId.
      registerApiRoute("/scout/brief/:runId/decision", {
        method: "POST",
        handler: async (c) => {
          const runId = c.req.param("runId");
          const body = (await c.req.json().catch(() => ({}))) as { approved?: unknown };
          if (typeof body.approved !== "boolean") {
            return c.json({ error: "body must be { approved: boolean }" }, 400);
          }
          const workflow = c.get("mastra").getWorkflow("briefing");
          const run = await workflow.createRun({ runId });
          const result = await run.resume({
            step: "approval",
            resumeData: { approved: body.approved },
          });
          return c.json(briefingResponse(runId, result));
        },
      }),
    ],
  },
  bundler: { externals: ["@copilotkit/runtime"] },
});

/** Normalize a workflow result to a small, stable contract for the UI. */
function briefingResponse(runId: string, result: any) {
  if (result.status === "suspended") {
    const payload = result.steps?.approval?.suspendPayload ?? null;
    return {
      runId,
      status: "awaiting_approval" as const,
      title: payload?.title ?? "Scout has a draft brief ready",
      summary: payload?.summary ?? "",
      scout_log: payload?.scout_log ?? [],
    };
  }
  if (result.status === "success") {
    return { runId, status: "done" as const, ...result.result };
  }
  return { runId, status: "failed" as const, error: String(result.error ?? "briefing failed") };
}
