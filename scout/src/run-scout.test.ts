import { afterEach, describe, expect, it, vi } from "vitest";
import { runScout } from "./run-scout";
import { importInboxFn, researchFn } from "./mastra/tools/backend";

const now = () => "2026-10-05T12:00:00.000Z";

describe("runScout", () => {
  it("logs a thread read, flagged commitments and research with sources", async () => {
    const log = await runScout({
      now,
      importInbox: async () => ({
        degraded: false,
        counterpart_name: "Dana",
        claim_count: 9,
        commitments: ["Revisit comp in Q3"],
      }),
      research: async () => ({
        degraded: false,
        claim_count: 5,
        sources: ["https://a.example", "https://b.example", "https://c.example"],
      }),
    });

    expect(log.map((e) => e.action)).toEqual([
      "read_thread",
      "flagged_commitment",
      "researched",
    ]);
    expect(log[0].detail).toBe("Read your thread with Dana — 9 claims");
    expect(log[2].sources).toHaveLength(3);
    expect(log.every((e) => e.actor === "scout" && e.ts === now())).toBe(true);
  });

  it("logs skipped (never invented results) when both services are degraded", async () => {
    const log = await runScout({
      now,
      importInbox: async () => ({
        degraded: true,
        counterpart_name: null,
        claim_count: 0,
        commitments: [],
      }),
      research: async () => ({ degraded: true, claim_count: 0, sources: [] }),
    });

    expect(log.map((e) => e.action)).toEqual(["skipped", "skipped"]);
    expect(log.some((e) => e.sources)).toBe(false);
  });

  it("labels the backend's bundled sample thread honestly", async () => {
    const log = await runScout({
      now,
      importInbox: async () => ({
        degraded: true,
        counterpart_name: "Dana",
        claim_count: 7,
        commitments: [],
      }),
      research: async () => ({ degraded: true, claim_count: 0, sources: [] }),
    });

    expect(log[0].action).toBe("read_thread");
    expect(log[0].detail).toContain("(sample thread)");
  });

  it("passes the counterpart into the research request", async () => {
    const research = vi.fn(async () => ({ degraded: false, claim_count: 0, sources: [] }));
    await runScout({
      now,
      importInbox: async () => ({
        degraded: false,
        counterpart_name: "Dana",
        claim_count: 1,
        commitments: [],
      }),
      research,
    });
    expect(research).toHaveBeenCalledWith(
      expect.objectContaining({ counterpart_name: "Dana" }),
    );
  });
});

describe("backend tool mapping", () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (body: unknown, ok = true) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body })),
    );

  it("maps /context/import into counts, name and commitments", async () => {
    respond({
      degraded: false,
      event: { counterpart_profile: { name: "Dana" } },
      brief: {
        claims: [
          { claim: "Promised a Q3 review", relevance: "commitment" },
          { claim: "Band is 140-160k", relevance: "number" },
        ],
      },
    });
    expect(await importInboxFn()).toEqual({
      degraded: false,
      counterpart_name: "Dana",
      counterpart_role: null,
      claim_count: 2,
      commitments: ["Promised a Q3 review"],
    });
  });

  it("treats degraded import responses (null event/brief) as empty", async () => {
    respond({ event: null, brief: null, degraded: true });
    expect(await importInboxFn()).toMatchObject({
      degraded: true,
      counterpart_name: null,
      claim_count: 0,
    });
  });

  it("dedupes research sources", async () => {
    respond({
      claims: [{ source_ids: ["https://a"] }, { source_ids: ["https://a", "https://b"] }],
    });
    expect(await researchFn({ topic: "x" })).toEqual({
      degraded: false,
      claim_count: 2,
      sources: ["https://a", "https://b"],
    });
  });

  it("degrades instead of throwing on HTTP errors and network failures", async () => {
    respond({}, false);
    expect((await researchFn({ topic: "x" })).degraded).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect((await importInboxFn()).degraded).toBe(true);
  });
});
