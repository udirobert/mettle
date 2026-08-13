'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, ClipboardList, Copy, Flag, Mail } from 'lucide-react';
import { useConversationState } from '@/hooks/use-conversation-state';
import { buildFollowUpMemo, buildMailtoHref, copyText } from '@/lib/share-artifacts';

function classifyNote(note: string): 'commitment' | 'assumption' | 'next' {
  const lower = note.toLowerCase();
  if (
    lower.includes('next') ||
    lower.includes('follow-up') ||
    lower.includes('follow up') ||
    lower.includes('send') ||
    lower.includes('prepare') ||
    lower.includes('within 24')
  ) {
    return 'next';
  }
  if (
    lower.includes('commit') ||
    lower.includes('agreed') ||
    lower.includes('promised') ||
    lower.includes('will deliver')
  ) {
    return 'commitment';
  }
  return 'assumption';
}

/** Debrief: what changed and what to do. The record stays folded. */
export function DebriefView() {
  const { state, runDebrief, isAgentRunning } = useConversationState();
  const [showRecord, setShowRecord] = useState(false);
  const [memoStatus, setMemoStatus] = useState<string | null>(null);
  const notes = state.debrief_notes ?? [];
  const transcript = state.transcript ?? [];
  const nudges = state.nudges_sent ?? [];
  const counterpartFull =
    typeof state.counterpart_profile?.name === 'string'
      ? state.counterpart_profile.name
      : 'Counterpart';
  const counterpartName = counterpartFull.split(' ')[0] || 'Counterpart';

  const nextNotes = notes.filter((note) => classifyNote(note) === 'next');
  const commitmentNotes = notes.filter((note) => classifyNote(note) === 'commitment');
  const assumptionNotes = notes.filter((note) => classifyNote(note) === 'assumption');
  const lead = nextNotes[0] ?? commitmentNotes[0] ?? notes[0];

  const memo = buildFollowUpMemo({
    counterpart: counterpartFull,
    stakes: state.stakes,
    nextMove: lead,
    commitments: commitmentNotes,
    stillOpen: assumptionNotes,
    alsoDo: nextNotes.slice(1),
  });

  const sendMemo = () => {
    window.location.href = buildMailtoHref(memo.subject, memo.body);
  };

  const copyMemo = async () => {
    const text = `${memo.subject}\n\n${memo.body}`;
    const ok = await copyText(text);
    setMemoStatus(ok ? 'Follow-up memo copied' : 'Copy failed');
    window.setTimeout(() => setMemoStatus(null), 2200);
  };

  return (
    <div className="mettle-phase">
      <header>
        <p className="mettle-kicker">After the room</p>
        <h2 className="mettle-headline">Leave with the next move, not a transcript.</h2>
      </header>

      {notes.length === 0 ? (
        <section className="mettle-card mettle-card--accent">
          <p className="mettle-kicker">
            <ClipboardList size={13} /> Close the record
          </p>
          <strong>
            {transcript.length} turns · {nudges.length} signal{nudges.length === 1 ? '' : 's'}
          </strong>
          <p>Pull commitments, what stayed open, and one concrete follow-up.</p>
          <button
            className="mettle-action"
            disabled={isAgentRunning || transcript.length === 0}
            onClick={() => void runDebrief()}
            type="button"
            style={{ marginTop: 12 }}
          >
            <ClipboardList size={14} aria-hidden="true" />
            {isAgentRunning ? 'Synthesizing…' : 'Generate debrief'}
          </button>
        </section>
      ) : (
        <>
          {lead && (
            <section className="mettle-card mettle-card--signal" aria-label="Next move">
              <p className="mettle-kicker">
                <Flag size={13} /> Next move
              </p>
              <strong>{lead}</strong>
            </section>
          )}

          <section className="mettle-card" aria-label="Follow-up memo">
            <p className="mettle-kicker">
              <Mail size={13} /> Send the follow-up
            </p>
            <strong>One memo for the firm — not the transcript.</strong>
            <p className="mt-2">
              Opens your email with commitments, open items, and the next move. No live record
              attached.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button className="mettle-action" onClick={sendMemo} type="button">
                <Mail size={14} aria-hidden="true" /> Send follow-up memo
              </button>
              <button className="mettle-icon-action" onClick={() => void copyMemo()} type="button">
                <Copy size={14} aria-hidden="true" /> Copy memo
              </button>
            </div>
            {memoStatus && (
              <p
                className="mt-2 text-xs font-mono font-bold uppercase tracking-wide text-[var(--ink-soft)]"
                role="status"
              >
                {memoStatus}
              </p>
            )}
          </section>

          {commitmentNotes.length > 0 && (
            <section>
              <p className="mettle-kicker">Commitments</p>
              <div className="grid gap-2 mt-2">
                {commitmentNotes.map((note, index) => (
                  <div className="mettle-card" key={`commit-${index}`}>
                    <p className="mettle-kicker">
                      <CheckCircle2 size={13} /> Locked in
                    </p>
                    <strong>{note}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          {assumptionNotes.length > 0 && (
            <section>
              <p className="mettle-kicker">Still open</p>
              <div className="grid gap-2 mt-2">
                {assumptionNotes.map((note, index) => (
                  <div className="mettle-card mettle-card--risk" key={`open-${index}`}>
                    <strong>{note}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          {nextNotes.length > 1 && (
            <section>
              <p className="mettle-kicker">Also do</p>
              <ul className="mettle-list mt-2">
                {nextNotes.slice(1).map((note, index) => (
                  <li key={`next-${index}`}>{note}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <button
        className="mettle-fold"
        onClick={() => setShowRecord((value) => !value)}
        type="button"
        aria-expanded={showRecord}
      >
        <span>
          The record · {transcript.length} turns
          {nudges.length > 0 ? ` · ${nudges.length} signals` : ''}
        </span>
        <ChevronDown
          size={16}
          className={showRecord ? 'rotate-180 transition-transform' : 'transition-transform'}
          aria-hidden="true"
        />
      </button>
      {showRecord && (
        <section className="mettle-list">
          {transcript.length === 0 ? (
            <li>No conversation turns captured yet.</li>
          ) : (
            transcript.map((turn, index) => (
              <li key={`${turn.timestamp}-${index}`}>
                <strong>{turn.speaker === 'user' ? 'You' : counterpartName}:</strong> {turn.text}
              </li>
            ))
          )}
        </section>
      )}
    </div>
  );
}
