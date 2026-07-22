"use client";

import { useConversationState } from "@/hooks/use-conversation-state";

/**
 * Debrief view — shared by both owners.
 *
 * Post-conversation summary: commitments, unanswered objections, next actions.
 * Both owners contribute; this shell renders state.debrief_notes and the
 * transcript/nudge history for review.
 */
export function DebriefView() {
  const { state } = useConversationState();
  const notes = state.debrief_notes ?? [];
  const transcript = state.transcript ?? [];
  const nudges = state.nudges_sent ?? [];

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto p-6">
      <header>
        <h2 className="text-xl font-semibold">Debrief</h2>
        <p className="text-sm opacity-70 mt-1">
          What happened, what to follow up on.
        </p>
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
            <li key={i} className="text-sm rounded border border-current/10 p-3">
              {note}
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
