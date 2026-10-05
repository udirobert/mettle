import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { runScout, type ScoutEvent } from "../../run-scout";

/**
 * Pre-arrival briefing with a durable human gate:
 *
 *   gather ──► approval (suspends until the user decides) ──► release
 *
 * Scout drafts; the user decides. The suspended snapshot lives in Mastra
 * storage (Neon Postgres in production), so the decision can arrive minutes
 * or hours later — including after a server restart.
 */

const eventSchema = z.object({
  ts: z.string(),
  actor: z.literal("scout"),
  action: z.string(),
  detail: z.string(),
  sources: z.array(z.string()).optional(),
});

const draftSchema = z.object({
  scout_log: z.array(eventSchema),
  summary: z.string(),
});

export const approvalSuspendSchema = z.object({
  title: z.string(),
  summary: z.string(),
  scout_log: z.array(eventSchema),
});
export const approvalResumeSchema = z.object({ approved: z.boolean() });

export const briefingOutputSchema = z.object({
  released: z.boolean(),
  scout_log: z.array(eventSchema),
});

export function summarize(log: ScoutEvent[]): string {
  const read = log.find((e) => e.action === "read_thread");
  const researched = log.find((e) => e.action === "researched");
  const commitments = log.filter((e) => e.action === "flagged_commitment").length;
  const skipped = log.filter((e) => e.action === "skipped").length;
  const parts = [
    read ? read.detail : "No thread read",
    researched ? researched.detail : "no public research",
    commitments ? `${commitments} commitment(s) flagged` : null,
    skipped ? `${skipped} step(s) skipped` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

const gather = createStep({
  id: "gather",
  description: "Read the forwarded thread and run public research",
  inputSchema: z.object({}),
  outputSchema: draftSchema,
  execute: async () => {
    const scout_log = await runScout();
    return { scout_log, summary: summarize(scout_log) };
  },
});

const approval = createStep({
  id: "approval",
  description: "Wait for the user to release the draft brief to the keep/reject gate",
  inputSchema: draftSchema,
  outputSchema: draftSchema.extend({ approved: z.boolean() }),
  suspendSchema: approvalSuspendSchema,
  resumeSchema: approvalResumeSchema,
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return await suspend({
        title: "Scout has a draft brief ready",
        summary: inputData.summary,
        scout_log: inputData.scout_log,
      });
    }
    return { ...inputData, approved: resumeData.approved };
  },
});

const release = createStep({
  id: "release",
  description: "Release the draft (still claim-by-claim pending) or discard it",
  inputSchema: draftSchema.extend({ approved: z.boolean() }),
  outputSchema: briefingOutputSchema,
  execute: async ({ inputData }) => {
    const { approved, scout_log } = inputData;
    const now = new Date().toISOString();
    return {
      released: approved,
      scout_log: [
        ...scout_log,
        {
          ts: now,
          actor: "scout" as const,
          action: approved ? "released_brief" : "discarded_brief",
          detail: approved
            ? "You released the draft — claims are still pending your keep/reject"
            : "You discarded the draft — nothing reaches the Coach",
        },
      ],
    };
  },
});

export const briefingWorkflow = createWorkflow({
  id: "briefing",
  inputSchema: z.object({}),
  outputSchema: briefingOutputSchema,
})
  .then(gather)
  .then(approval)
  .then(release)
  .commit();
