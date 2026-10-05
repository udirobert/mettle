/**
 * Proves the briefing approval survives a process boundary.
 *
 *   parent: start a run -> it suspends at the approval gate, snapshot stored
 *   child : a brand-new Node process loads that snapshot by runId and decides
 *
 * Runs against whatever storage is configured (Neon when DATABASE_URL is set).
 *   npm run smoke:briefing
 */
import { spawnSync } from "node:child_process";
import { mastra } from "../src/mastra/index";

const workflow = mastra.getWorkflow("briefing");

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

async function resumeInChild(mode: string, runId: string, approved: boolean) {
  const run = await workflow.createRun({ runId });
  const result = await run.resume({ step: "approval", resumeData: { approved } });
  if (result.status !== "success") fail(`${mode}: expected success, got ${result.status}`);
  const out = result.result as { released: boolean; scout_log: { action: string }[] };
  if (out.released !== approved) fail(`${mode}: released=${out.released}, wanted ${approved}`);
  const last = out.scout_log.at(-1)?.action;
  const want = approved ? "released_brief" : "discarded_brief";
  if (last !== want) fail(`${mode}: last event ${last}, wanted ${want}`);
  console.log(`  child pid ${process.pid}: ${mode} -> released=${out.released}, last=${last}`);
}

async function main() {
  const [, , flag, runId, decision] = process.argv;

  if (flag === "--resume") {
    await resumeInChild(decision === "approve" ? "approve" : "reject", runId, decision === "approve");
    process.exit(0);
  }

  console.log(`parent pid ${process.pid}`);
  for (const decision of ["approve", "reject"] as const) {
    const run = await workflow.createRun();
    const started = await run.start({ inputData: {} });
    if (started.status !== "suspended") fail(`${decision}: expected suspended, got ${started.status}`);
    console.log(`✓ ${decision}: suspended at the gate (run ${run.runId})`);

    const child = spawnSync(
      process.execPath,
      ["--env-file=.env", "--import", "tsx", "scripts/smoke-briefing.ts", "--resume", run.runId, decision],
      { stdio: "inherit", env: process.env },
    );
    if (child.status !== 0) fail(`${decision}: child process exited ${child.status}`);
    console.log(`✓ ${decision}: decided from a fresh process`);
  }
  console.log("✓ approval gate is durable across processes");
  process.exit(0);
}

main().catch((e) => fail(String(e?.message ?? e)));
