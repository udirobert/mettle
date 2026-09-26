'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  Flag,
  Mail,
  Link2,
} from 'lucide-react';
import { Fold } from '@/components/fold';
import { useConversationState } from '@/hooks/use-conversation-state';
import { buildFollowUpMemo, buildMailtoHref, copyText } from '@/lib/share-artifacts';
import { encodeShareLink } from '@/lib/share-link';

type PersistedDebrief = {
  notes: string[];
  counterpart: string;
  savedAt: string;
};

function debriefKey(counterpart: string) {
  return `mettle.debrief.${counterpart.toLowerCase().replace(/\s+/g, '-')}`;
}

function carryKey(counterpart: string) {
  return `mettle.carry.${counterpart.toLowerCase().replace(/\s+/g, '-')}`;
}

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
  const [memoStatus, setMemoStatus] = useState<string | null>(null);
  const notes = state.debrief_notes ?? [];

  const carryForward = () => {
    if (!priorDebrief) return;
    const open = priorDebrief.notes.filter((note) => classifyNote(note) !== 'commitment');
    try {
      window.localStorage.setItem(
        carryKey(counterpartFull),
        JSON.stringify({ items: open, from: priorDebrief.savedAt }),
      );
    } catch {
      /* ignore */
    }
    setCarried(true);
  };
  const [carried, setCarried] = useState(false);
  const transcript = state.transcript ?? [];
  const nudges = state.nudges_sent ?? [];
  const counterpartFull =
    typeof state.counterpart_profile?.name === 'string'
      ? state.counterpart_profile.name
      : 'Counterpart';
  const counterpartName = counterpartFull.split(' ')[0] || 'Counterpart';

  // Persist every generated debrief keyed by counterpart so the next event can carry it forward.
  useEffect(() => {
    if (notes.length === 0) return;
    const payload: PersistedDebrief = {
      notes,
      counterpart: counterpartFull,
      savedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(debriefKey(counterpartFull), JSON.stringify(payload));
    } catch {
      /* storage unavailable — debrief stays in-session only */
    }
  }, [notes, counterpartFull]);

  const priorDebrief = useMemo<PersistedDebrief | null>(() => {
    try {
      const raw = window.localStorage.getItem(debriefKey(counterpartFull));
      return raw ? (JSON.parse(raw) as PersistedDebrief) : null;
    } catch {
      return null;
    }
    // Read once per counterpart change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counterpartFull]);

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

  const downloadMemo = () => {
    const text = `# ${memo.subject}\n\n${memo.body}\n`;
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mettle-debrief-${counterpartFull.toLowerCase().replace(/\s+/g, '-')}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // Shareable read-only link: actions only, encoded in the URL fragment so
  // nothing is stored server-side. Respects privacy mode (omits stakes there).
  const copyShareLink = async () => {
    const link = encodeShareLink({
      v: 1,
      counterpart: counterpartFull,
      stakes: (state.privacy_mode ?? 'private') === 'private' ? undefined : state.stakes,
      savedAt: new Date().toISOString(),
      commitments: commitmentNotes,
      stillOpen: assumptionNotes,
      alsoDo: nextNotes.slice(1),
      source: state.conversation_source === 'rehearsal' ? 'rehearsal' : 'live',
    });
    const ok = await copyText(link);
    setMemoStatus(ok ? 'Share link copied — read-only, actions only' : 'Copy failed');
    window.setTimeout(() => setMemoStatus(null), 2600);
  };

  return (
    <div className="mettle-phase">
      <header>
        <p className="mettle-kicker">
          {state.conversation_source === 'rehearsal'
            ? 'From a rehearsal · commitments are intended lines, not promises'
            : `From the live conversation · commitments are owed to ${counterpartName}`}
        </p>
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
      ) : null}

      {notes.length === 0 && priorDebrief && (
        <Fold
          label="From your last conversation"
          meta={new Date(priorDebrief.savedAt).toLocaleDateString()}
        >
          <section aria-label="Previous debrief for this counterpart">
            <ul className="mettle-list">
              {priorDebrief.notes.slice(0, 3).map((note, index) => (
                <li key={`prior-${index}`}>{note}</li>
              ))}
            </ul>
            {carried ? (
              <p
                className="mettle-kicker"
                role="status"
                style={{ color: 'var(--signal-strong-ink)' }}
              >
                <CheckCircle2 size={12} className="inline" aria-hidden="true" /> Open items will
                surface in the next prep with {counterpartName}.
              </p>
            ) : (
              <button className="mettle-icon-action mt-2" onClick={carryForward} type="button">
                <ArrowRight size={13} aria-hidden="true" /> Carry open items into next prep
              </button>
            )}
          </section>
        </Fold>
      )}

      {notes.length > 0 && (
        <>
          <section className="mettle-card mettle-card--signal" aria-label="Next move">
            <p className="mettle-kicker">
              <Flag size={13} /> Next move
            </p>
            <strong>{lead}</strong>
            <p>
              One memo for the firm with commitments, open items, and this move — never the
              transcript.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button className="mettle-action" onClick={sendMemo} type="button">
                <Mail size={14} aria-hidden="true" /> Send follow-up memo
              </button>
              <button className="mettle-icon-action" onClick={() => void copyMemo()} type="button">
                <Copy size={14} aria-hidden="true" /> Copy
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

          <div>
            {commitmentNotes.length > 0 && (
              <Fold label="Commitments" meta={`${commitmentNotes.length} locked in`}>
                <ul className="mettle-list">
                  {commitmentNotes.map((note, index) => (
                    <li key={`commit-${index}`}>
                      <CheckCircle2 size={12} className="mr-1 inline" aria-hidden="true" />
                      {note}
                    </li>
                  ))}
                </ul>
              </Fold>
            )}
            {assumptionNotes.length > 0 && (
              <Fold label="Still open" meta={`${assumptionNotes.length}`}>
                <div className="grid gap-2">
                  {assumptionNotes.map((note, index) => (
                    <div className="mettle-card mettle-card--risk" key={`open-${index}`}>
                      <strong>{note}</strong>
                    </div>
                  ))}
                </div>
              </Fold>
            )}
            {nextNotes.length > 1 && (
              <Fold label="Also do" meta={`${nextNotes.length - 1}`}>
                <ul className="mettle-list">
                  {nextNotes.slice(1).map((note, index) => (
                    <li key={`next-${index}`}>{note}</li>
                  ))}
                </ul>
              </Fold>
            )}
            <Fold label="Other ways to share" meta="download · read-only link">
              <div className="flex flex-wrap gap-2">
                <button className="mettle-icon-action" onClick={downloadMemo} type="button">
                  <Download size={14} aria-hidden="true" /> Download memo
                </button>
                <button
                  className="mettle-icon-action"
                  onClick={() => void copyShareLink()}
                  type="button"
                >
                  <Link2 size={14} aria-hidden="true" /> Copy share link
                </button>
              </div>
            </Fold>
          </div>
        </>
      )}

      <Fold
        label="The record"
        meta={`${transcript.length} turns${nudges.length > 0 ? ` · ${nudges.length} signals` : ''}`}
      >
        <ul className="mettle-list">
          {transcript.length === 0 ? (
            <li>No conversation turns captured yet.</li>
          ) : (
            transcript.map((turn, index) => (
              <li key={`${turn.timestamp}-${index}`}>
                <strong>{turn.speaker === 'user' ? 'You' : counterpartName}:</strong> {turn.text}
              </li>
            ))
          )}
        </ul>
      </Fold>
    </div>
  );
}
