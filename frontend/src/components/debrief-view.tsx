'use client';

import { CheckCircle2, ClipboardList, Flag, MessagesSquare } from 'lucide-react';
import { useConversationState } from '@/hooks/use-conversation-state';

/** Post-conversation readout shared by the two implementation tracks. */
export function DebriefView() {
  const { state } = useConversationState();
  const notes = state.debrief_notes ?? [];
  const transcript = state.transcript ?? [];
  const nudges = state.nudges_sent ?? [];
  const counterpartName =
    String(state.counterpart_profile?.name ?? '').split(' ')[0] || 'Counterpart';

  return (
    <div className="mettle-phase">
      <header>
        <p className="mettle-kicker">After the room</p>
        <h2 className="mettle-headline">Turn the conversation into leverage.</h2>
        <p className="mettle-copy">
          Capture commitments, expose what stayed unresolved, and decide what must happen before the
          next touchpoint.
        </p>
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
                The debrief node will pull out commitments, open objections, and named next actions.
              </p>
            </div>
          ) : (
            notes.map((note, index) => (
              <div className="mettle-card" key={`${note}-${index}`}>
                <p className="mettle-kicker">
                  <CheckCircle2 size={13} /> Action {index + 1}
                </p>
                <strong>{note}</strong>
              </div>
            ))
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
                <strong>{turn.speaker === 'user' ? 'You' : counterpartName}:</strong> {turn.text}
              </li>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
