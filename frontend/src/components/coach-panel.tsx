"use client";

import { useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

import { useConversationState } from "@/hooks/use-conversation-state";

/**
 * Coach phase UI — owned by Person A (before + after).
 *
 * Renders the pre-conversation prep surface: stakes, counterpart profile, and
 * the weak points surfaced during prep. "Run prep" executes the coach node,
 * which loads the scenario and sharpens weak points with the LLM stress test.
 */
export function CoachPanel() {
  const { state, setPartial } = useConversationState();
  const { agent } = useAgent();
  const [running, setRunning] = useState(false);

  const runPrep = async () => {
    setRunning(true);
    // agent.setState replaces state wholesale — send the full object.
    setPartial({
      ...state,
      phase: "prep",
      scenario_id: state.scenario_id || "lp_renewal",
    });
    try {
      await (
        agent as unknown as { runAgent?: () => Promise<unknown> }
      ).runAgent?.();
    } finally {
      setRunning(false);
    }
  };

  const weakPoints = state.user_weak_points ?? [];

  const addWeakPoint = () => {
    const next = [...weakPoints, "New weak point — edit me"];
    setPartial({ user_weak_points: next });
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Coach — Prep</h2>
          <p className="text-sm opacity-70 mt-1">
            Scenario: {state.scenario_id || "—"}
          </p>
        </div>
        <button
          onClick={runPrep}
          disabled={running}
          className="px-4 py-2 rounded text-sm font-medium border border-current/20 hover:bg-current/5 disabled:opacity-50"
        >
          {running ? "Preparing…" : "Run prep"}
        </button>
      </header>

      <section>
        <h3 className="text-sm font-medium uppercase tracking-wide opacity-60">
          Stakes
        </h3>
        <p className="mt-2">{state.stakes || "Not set yet."}</p>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium uppercase tracking-wide opacity-60">
            Your weak points
          </h3>
          <button
            onClick={addWeakPoint}
            className="text-xs px-2 py-1 rounded border border-current/20 hover:bg-current/5"
          >
            + add
          </button>
        </div>
        <ul className="mt-2 flex flex-col gap-2">
          {weakPoints.length === 0 && (
            <li className="text-sm opacity-50">No weak points surfaced yet.</li>
          )}
          {weakPoints.map((point, i) => (
            <li
              key={i}
              className="text-sm rounded border border-current/10 p-3"
            >
              {point}
            </li>
          ))}
        </ul>
      </section>

    </div>
  );
}
