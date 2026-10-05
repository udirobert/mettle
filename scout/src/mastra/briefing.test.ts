import { describe, expect, it } from "vitest";
import { summarize } from "./workflows/briefing";
import { storageKind } from "./storage";
import type { ScoutEvent } from "../run-scout";

const ev = (action: string, detail: string): ScoutEvent => ({
  ts: "2026-10-05T00:00:00.000Z",
  actor: "scout",
  action,
  detail,
});

describe("summarize", () => {
  it("joins the thread read, research and counts", () => {
    const s = summarize([
      ev("read_thread", "Read your thread with Dana — 9 claims"),
      ev("flagged_commitment", "x"),
      ev("flagged_commitment", "y"),
      ev("researched", "Found 4 claims across 3 public sources"),
    ]);
    expect(s).toBe(
      "Read your thread with Dana — 9 claims · Found 4 claims across 3 public sources · 2 commitment(s) flagged",
    );
  });

  it("is honest when everything was skipped", () => {
    const s = summarize([ev("skipped", "a"), ev("skipped", "b")]);
    expect(s).toContain("No thread read");
    expect(s).toContain("no public research");
    expect(s).toContain("2 step(s) skipped");
  });
});

describe("storageKind", () => {
  it("reports neon only when DATABASE_URL is set", () => {
    expect(storageKind({ DATABASE_URL: "postgres://x" })).toBe("neon");
    expect(storageKind({ DATABASE_URL: "  " })).toBe("local");
    expect(storageKind({})).toBe("local");
  });
});
