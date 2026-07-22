'use client';

import { useState } from 'react';
import { useAgent } from '@copilotkit/react-core/v2';
import { CheckCircle2, ClipboardList, Flag, MessagesSquare } from 'lucide-react';

import { useConversationState } from '@/hooks/use-conversation-state';

/**
 * Post-conversation readout, owned by Person A (before + after).
 *
 * "Generate debrief" runs the debrief node over the accumulated transcript +
 * nudges: outcome, commitments (including accidental soft promises),
 * unanswered objections, weak-point verdicts, and a follow-up email draft.
 */
function noteTone(note: string): 'risk' | 'signal' | 'accent' | undefined {
  if (note.startsWith('OUTCOME:')) return 'signal';
  if (note.startsWith('COMMITMENT:')) return 'risk';
  if (note.startsWith('OPEN:')) return 'accent';
  return undefined;
}

export function DebriefView() {
  const { state, setPartial } = useConversationState();
  const { agent } = useAgent();
  const [running, setRunning] = useState(false);
  const notes = state.debrief_notes ?? [];
  const transcript = state.transcript ?? [];
  const nudges = state.nudges_sent ?? [];
  const counterpartLabel =
    (state.counterpart_profile as { name?: string })?.name || 'Counterpart';

  const runDebrief = async () => {
    setRunning(true);
    setPartial({ phase: 'debrief' });
    try {
      await (agent as unknown as { runAgent?: () => Promise<unknown> }).runAgent?.();
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mettle-phase">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="mettle-kicker">After the room</p>
          <h2 className="mettle-headline">Turn the conversation into leverage.</h2>
          <p className="mettle-copy">
            Capture commitments, expose what stayed unresolved, and decide what must happen before
            the next touchpoint.
          </p>
        </div>
        <button
          className="mettle-action"
          onClick={runDebrief}
          disabled={running || transcript.length === 0}
          type="button"
        >
          {running ? 'Analyzing…' : 'Generate debrief'}
        </button>
      </header>

      <div className="mettle-grid">
        <section className="mettle-card mettle-card--signal">
          <p className="mettle-kicker">
            <MessagesSquare size={13} /> Conversation
          </p>
          <strong>{transcript.length} turns captured</strong>
          <p>The record is available for a clean post-meeting read.</p>
        </section>
        <section className="mettle-card mettle-card--risk">
          <p className="mettle-kicker">
            <Flag size={13} /> Intervention
          </p>
          <strong>{nudges.length} signals surfaced</strong>
          <p>Review the moments where the conversation started to drift.</p>
        </section>
      </div>

      <section>
        <h3 className="mettle-section-title">Commitments and follow-ups</h3>
        <div className="grid gap-2 mt-3">
          {notes.length === 0 ? (
            <div className="mettle-card mettle-card--accent">
              <p className="mettle-kicker">
                <ClipboardList size={13} /> Ready for synthesis
              </p>
              <strong>Close the meeting before you close the record.</strong>
              <p>
                Generate the debrief to pull out commitments, open objections, and named next
                actions.
              </p>
            </div>
          ) : (
            notes.map((note, index) => {
              const tone = noteTone(note);
              return (
                <div
                  className={`mettle-card${tone ? ` mettle-card--${tone}` : ''}`}
                  key={`${note}-${index}`}
                >
                  <p className="mettle-kicker">
                    <CheckCircle2 size={13} /> {note.split(':')[0]}
                  </p>
                  <strong style={{ whiteSpace: 'pre-line' }}>
                    {(note.split(':').slice(1).join(':').trim() || note).replaceAll('\\n', '\n')}
                  </strong>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section>
        <h3 className="mettle-section-title">The record</h3>
        <div className="mettle-list mt-3">
          {transcript.length === 0 ? (
            <li>No conversation turns captured yet.</li>
          ) : (
            transcript.map((turn, index) => (
              <li key={`${turn.timestamp}-${index}`}>
                <strong>{turn.speaker === 'user' ? 'You' : counterpartLabel}:</strong> {turn.text}
              </li>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
