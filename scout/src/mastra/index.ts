import { Mastra } from "@mastra/core/mastra";
import { registerCopilotKit } from "@ag-ui/mastra/copilotkit";
import { registerApiRoute } from "@mastra/core/server";
import { scoutAgent } from "./agents/scout-agent";
import { runScout } from "../run-scout";

export const mastra = new Mastra({
  agents: { scout: scoutAgent },
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
    ],
  },
  bundler: { externals: ["@copilotkit/runtime"] },
});
