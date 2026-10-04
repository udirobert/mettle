import {
  importInboxFn,
  researchFn,
  type InboxResult,
  type ResearchInput,
  type ResearchResult,
} from "./mastra/tools/backend";

/** Pinned contract (docs/HACKATHON_SPLIT.md). */
export type ScoutEvent = {
  ts: string;
  actor: "scout";
  action: string;
  detail: string;
  sources?: string[];
};

export type ScoutDeps = {
  importInbox: () => Promise<InboxResult>;
  research: (input: ResearchInput) => Promise<ResearchResult>;
  now?: () => string;
  /** Topic used for the public-research step. */
  topic?: (counterpart: string | null) => string;
};

const defaultTopic = (who: string | null) =>
  who
    ? `compensation band and negotiation context for a review with ${who}`
    : "compensation band for the user's role";

/**
 * Deterministic, LLM-free Scout: the fallback the demo can always rely on.
 * Same tools, same ScoutEvent shape as the Mastra agent, so the UI can't
 * tell the difference. Degraded steps are logged as "skipped", never invented.
 */
export async function runScout(deps?: Partial<ScoutDeps>): Promise<ScoutEvent[]> {
  const d: ScoutDeps = {
    importInbox: importInboxFn,
    research: researchFn,
    now: () => new Date().toISOString(),
    topic: defaultTopic,
    ...deps,
  };
  const now = d.now ?? (() => new Date().toISOString());
  const log: ScoutEvent[] = [];
  const push = (action: string, detail: string, sources?: string[]) =>
    log.push({ ts: now(), actor: "scout", action, detail, ...(sources?.length ? { sources } : {}) });

  const inbox = await d.importInbox();
  const who = inbox.counterpart_name;
  if (inbox.degraded && inbox.claim_count === 0) {
    push("skipped", "Inbox unavailable — no forwarded thread to read");
  } else {
    // Degraded-with-claims means the backend served its bundled sample thread.
    const sample = inbox.degraded ? " (sample thread)" : "";
    push(
      "read_thread",
      (who
        ? `Read your thread with ${who} — ${inbox.claim_count} claims`
        : `Read your forwarded thread — ${inbox.claim_count} claims`) + sample,
    );
    for (const c of inbox.commitments) {
      push("flagged_commitment", `Commitment on record: ${c}`);
    }
  }

  const found = await d.research({
    topic: (d.topic ?? defaultTopic)(who),
    ...(who ? { counterpart_name: who } : {}),
  });
  if (found.degraded) {
    push("skipped", "Public research unavailable — continuing without web sources");
  } else {
    push(
      "researched",
      `Found ${found.claim_count} claims across ${found.sources.length} public sources`,
      found.sources,
    );
  }
  return log;
}
