import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8123").replace(
  /\/$/,
  "",
);

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

type Claim = { claim?: string; relevance?: string; source_ids?: string[] };

export type InboxResult = {
  degraded: boolean;
  counterpart_name: string | null;
  claim_count: number;
  commitments: string[];
};

export type ResearchResult = {
  degraded: boolean;
  claim_count: number;
  sources: string[];
};

export type ResearchInput = {
  topic: string;
  counterpart_name?: string;
  organization?: string;
};

/** Lane A's /context/import, reduced to what Scout needs to log. Never throws. */
export async function importInboxFn(): Promise<InboxResult> {
  try {
    const data = await post<{
      degraded?: boolean;
      event?: { counterpart_profile?: { name?: string } } | null;
      brief?: { claims?: Claim[] } | null;
    }>("/context/import");
    const claims = data.brief?.claims ?? [];
    return {
      degraded: Boolean(data.degraded),
      counterpart_name: data.event?.counterpart_profile?.name ?? null,
      claim_count: claims.length,
      commitments: claims
        .filter((c) => c.relevance === "commitment" && c.claim)
        .map((c) => c.claim as string),
    };
  } catch {
    return { degraded: true, counterpart_name: null, claim_count: 0, commitments: [] };
  }
}

/** Lane A's /context/research, reduced to counts + source URLs. Never throws. */
export async function researchFn(input: ResearchInput): Promise<ResearchResult> {
  try {
    const data = await post<{ degraded?: boolean; claims?: Claim[] }>(
      "/context/research",
      input,
    );
    const claims = data.claims ?? [];
    return {
      degraded: Boolean(data.degraded),
      claim_count: claims.length,
      sources: [...new Set(claims.flatMap((c) => c.source_ids ?? []))],
    };
  } catch {
    return { degraded: true, claim_count: 0, sources: [] };
  }
}

export const importInbox = createTool({
  id: "import-inbox",
  description:
    "Read the forwarded thread from the agent's own inbox and return a draft event plus evidence claims (all pending the user's approval). Returns degraded=true if the inbox is not configured or unreachable.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    degraded: z.boolean(),
    counterpart_name: z.string().nullable(),
    claim_count: z.number(),
    commitments: z.array(z.string()),
  }),
  execute: async () => importInboxFn(),
});

export const research = createTool({
  id: "research",
  description:
    "Research a topic on the public web (e.g. comp bands for a role) and return claims with source URLs. Returns degraded=true if research is not configured or unreachable.",
  inputSchema: z.object({
    topic: z.string(),
    counterpart_name: z.string().optional(),
    organization: z.string().optional(),
  }),
  outputSchema: z.object({
    degraded: z.boolean(),
    claim_count: z.number(),
    sources: z.array(z.string()),
  }),
  execute: async (input) => researchFn(input),
});
