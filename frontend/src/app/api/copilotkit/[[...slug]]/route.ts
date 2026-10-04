import {
  CopilotRuntime,
  CopilotKitIntelligence,
  createCopilotEndpoint,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";
import { HttpAgent } from "@ag-ui/client";
import { MastraClient } from "@mastra/client-js";
import { MastraAgent } from "@ag-ui/mastra";
import { handle } from "hono/vercel";

const agentUrl =
  process.env.AGENT_URL ||
  process.env.LANGGRAPH_DEPLOYMENT_URL ||
  "http://localhost:8123";

// The standalone FastAPI service exposes an AG-UI endpoint at `/`. HttpAgent
// keeps Vercel as a thin CopilotKit runtime proxy while the graph stays on the
// long-lived backend that owns checkpoint persistence.
const defaultAgent = new HttpAgent({
  url: `${agentUrl.replace(/\/$/, "")}/`,
});

// The Mastra server's /copilotkit route is a full CopilotKit runtime, so a
// second HttpAgent cannot target it — register its agents as remote agents
// instead. Missing scout server → omit it; /context/import is the fallback.
const scoutUrl = process.env.SCOUT_URL || "http://localhost:4111";
let scoutAgents: Record<string, HttpAgent> = {};
try {
  // @ag-ui/mastra@1.x uses the newer @ag-ui/client 1.x type lineage; the
  // CopilotKit runtime here is on the 0.0.57 lineage. Same AG-UI wire
  // protocol — the cast bridges the type-version fork only.
  scoutAgents = (await MastraAgent.getRemoteAgents({
    mastraClient: new MastraClient({ baseUrl: scoutUrl }),
    resourceId: "scout",
  })) as unknown as Record<string, HttpAgent>;
} catch {
  scoutAgents = {};
}

const runtime = new CopilotRuntime({
  agents: { default: defaultAgent, ...scoutAgents },
  // --- copilotkit:intelligence (remove this block to opt out) ---
  ...(process.env.COPILOTKIT_LICENSE_TOKEN
    ? {
        intelligence: new CopilotKitIntelligence({
          apiKey: process.env.INTELLIGENCE_API_KEY ?? "",
          apiUrl: process.env.INTELLIGENCE_API_URL ?? "http://localhost:4201",
          wsUrl:
            process.env.INTELLIGENCE_GATEWAY_WS_URL ?? "ws://localhost:4401",
        }),
        // Anonymous per-visitor identity (issued by src/middleware.ts) so
        // thread history is scoped per browser. Replace with real auth before
        // any multi-user deployment handling sensitive data.
        identifyUser: (request) => {
          const cookie = request.headers
            .get("cookie")
            ?.split(";")
            .map((c) => c.trim())
            .find((c) => c.startsWith("mettle_sid="));
          const id = cookie?.slice("mettle_sid=".length) || "anonymous";
          return { id, name: "Mettle User" };
        },
        licenseToken: process.env.COPILOTKIT_LICENSE_TOKEN,
      }
    : { runner: new InMemoryAgentRunner() }),
  // --- /copilotkit:intelligence ---
  openGenerativeUI: true,
  a2ui: {
    injectA2UITool: false,
    defaultCatalogId: "mettle-nudge-catalog",
  },
  mcpApps: {
    servers: [
      {
        type: "http",
        url: process.env.MCP_SERVER_URL || "https://mcp.excalidraw.com",
        serverId: "example_mcp_app",
      },
    ],
  },
});

const app = createCopilotEndpoint({
  runtime,
  basePath: "/api/copilotkit",
});

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
