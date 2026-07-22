"use client";

import { useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

import { useConversationState } from "@/hooks/use-conversation-state";

/**
 * Debrief view — owned by Person A (before + after).
 *
 * Post-conversation analysis over the accumulated transcript and nudges:
 * outcome, commitments (including accidental soft promises), unanswered
 * objections, weak-point verdicts, and a sendable follow-up email draft.
 */
export function DebriefView() {
  const { state, setPartial } = useConversationState();
  const { agent } = useAgent();
  const [running, setRunning] = useState(false);
  const notes = state.debrief_notes ?? [];
  const transcript = state.transcript ?? [];
  const nudges = state.nudges_sent ?? [];

  const runDebrief = async () => {
    setRunning(true);
    setPartial({ phase: "debrief" });
    try {
      await (
        agent as unknown as { runAgent?: () => Promise<unknown> }
      ).runAgent?.();
    } finally {
      setRunning(false);
    }
  };

  const noteStyle = (note: string) => {
    if (note.startsWith("COMMITMENT:")) return "border-amber-500/40";
    if (note.startsWith("OPEN:")) return "border-red-500/40";
    if (note.startsWith("OUTCOME:")) return "border-green-500/40";
    return "border-current/10";
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Debrief</h2>
          <p className="text-sm opacity-70 mt-1">
            What happened, what to follow up on.
          </p>
        </div>
        <button
          onClick={runDebrief}
          disabled={running || transcript.length === 0}
          className="px-4 py-2 rounded text-sm font-medium border border-current/20 hover:bg-current/5 disabled:opacity-50"
        >
          {running ? "Analyzing…" : "Generate debrief"}
        </button>
      </header>

      <section>
        <h3 className="text-sm font-medium uppercase tracking-wide opacity-60">
          Notes
        </h3>
        <ul className="mt-2 flex flex-col gap-2">
          {notes.length === 0 && (
            <li className="text-sm opacity-50">No debrief notes yet.</li>
          )}
          {notes.map((note, i) => (
            <li
              key={i}
              className={`text-sm rounded border p-3 whitespace-pre-line ${noteStyle(note)}`}
            >
              {note.replaceAll("\\n", "\n")}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-medium uppercase tracking-wide opacity-60">
          Transcript ({transcript.length} turns)
        </h3>
        <div className="mt-2 flex flex-col gap-1 text-sm">
          {transcript.map((turn, i) => (
            <div key={i}>
              <span className="opacity-50 text-xs">{turn.speaker}: </span>
              {turn.text}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium uppercase tracking-wide opacity-60">
          Nudges sent ({nudges.length})
        </h3>
        <div className="mt-2 flex flex-col gap-1 text-sm">
          {nudges.map((n) => (
            <div key={n.id}>
              <span className="opacity-50 text-xs">{n.kind}: </span>
              {n.message}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
