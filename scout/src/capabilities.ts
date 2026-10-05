import { buildScoutModels } from "./mastra/models";
import { storageKind } from "./mastra/storage";

type Env = Record<string, string | undefined>;

export type Capabilities = {
  storage: "neon" | "local";
  /** Model providers in fallback order. Ids only — never keys or URLs. */
  models: string[];
  backend: { reachable: boolean; url: string };
  /** Plain-English summary a UI or judge can show verbatim. */
  summary: string;
};

/**
 * What is actually connected right now. Deliberately separates "configured"
 * from "reachable", so a demo never claims a live integration it doesn't have.
 */
export async function describeCapabilities(
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<Capabilities> {
  const storage = storageKind(env);
  const models = buildScoutModels(env).map((m) => m.id);
  const url = (env.BACKEND_URL ?? "http://localhost:8123").replace(/\/$/, "");

  let reachable = false;
  try {
    const res = await fetchImpl(`${url}/health`, { signal: AbortSignal.timeout(3000) });
    reachable = res.ok;
  } catch {
    reachable = false;
  }

  const summary = [
    storage === "neon" ? "State in Neon Postgres" : "State in a local file (not durable across machines)",
    `models: ${models.join(" → ")}`,
    reachable ? "backend reachable" : "backend unreachable — Scout will log skipped steps",
  ].join(" · ");

  return { storage, models, backend: { reachable, url: redactHost(url) }, summary };
}

function redactHost(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "[invalid url]";
  }
}
