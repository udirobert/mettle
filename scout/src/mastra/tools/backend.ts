import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { cleanUntrusted, safeSourceId } from "../../untrusted";

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
  counterpart_role?: string | null;
  claim_count: number;
  commitments: string[];
  /** Why the result is degraded or incomplete, when known. */
  reason?: string;
  /** Lines withheld from the model because they looked like instructions. */
  quarantined?: number;
};

export type ResearchResult = {
  degraded: boolean;
  claim_count: number;
  sources: string[];
  reason?: string;
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
      reason?: string;
      event?: { counterpart_profile?: { name?: string; role?: string } } | null;
      brief?: { claims?: Claim[] } | null;
    }>("/context/import");
    const claims = data.brief?.claims ?? [];
    const profile = data.event?.counterpart_profile;
    // Email-derived text is untrusted: clean it before it can reach a prompt.
    let quarantined = 0;
    const commitments: string[] = [];
    for (const c of claims) {
      if (c.relevance !== "commitment" || !c.claim) continue;
      const cleaned = cleanUntrusted(c.claim);
      if (cleaned.quarantined) quarantined += 1;
      if (cleaned.text) commitments.push(cleaned.text);
    }
    const name = cleanUntrusted(profile?.name, 80);
    const role = cleanUntrusted(profile?.role, 120);
    return {
      degraded: Boolean(data.degraded),
      counterpart_name: name.text || null,
      counterpart_role: role.text || null,
      claim_count: claims.length,
      commitments,
      ...(data.reason ? { reason: cleanUntrusted(data.reason, 160).text } : {}),
      ...(quarantined ? { quarantined } : {}),
    };
  } catch (err) {
    return {
      degraded: true,
      counterpart_name: null,
      counterpart_role: null,
      claim_count: 0,
      commitments: [],
      reason: `backend unreachable (${err instanceof Error ? err.message : "error"})`.slice(0, 160),
    };
  }
}

/** Lane A's /context/research, reduced to counts + source URLs. Never throws. */
export async function researchFn(input: ResearchInput): Promise<ResearchResult> {
  try {
    const data = await post<{ degraded?: boolean; reason?: string; claims?: Claim[] }>(
      "/context/research",
      input,
    );
    const claims = data.claims ?? [];
    // Source ids may be URLs or opaque ids; only well-formed URLs are surfaced,
    // with query strings and credentials stripped.
    const sources = [
      ...new Set(
        claims
          .flatMap((c) => c.source_ids ?? [])
          .map(safeSourceId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    return {
      degraded: Boolean(data.degraded),
      claim_count: claims.length,
      sources,
      ...(data.reason ? { reason: cleanUntrusted(data.reason, 160).text } : {}),
    };
  } catch (err) {
    return {
      degraded: true,
      claim_count: 0,
      sources: [],
      reason: `backend unreachable (${err instanceof Error ? err.message : "error"})`.slice(0, 160),
    };
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
    counterpart_role: z.string().nullable().optional(),
    claim_count: z.number(),
    commitments: z.array(z.string()),
    reason: z.string().optional(),
    quarantined: z.number().optional(),
  }),
  execute: async () => importInboxFn(),
});

export const research = createTool({
  id: "research",
  description:
    "Research a topic on the public web (e.g. comp bands for a role) and return claims with source URLs. Query by role or topic, never by a person's name. Returns degraded=true if research is not configured or unreachable.",
  inputSchema: z.object({
    topic: z.string(),
    counterpart_name: z.string().optional(),
    organization: z.string().optional(),
  }),
  outputSchema: z.object({
    degraded: z.boolean(),
    claim_count: z.number(),
    sources: z.array(z.string()),
    reason: z.string().optional(),
  }),
  execute: async (input) => researchFn(input),
});
