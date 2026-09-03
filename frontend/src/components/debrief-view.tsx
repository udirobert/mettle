'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Copy,
  Download,
  Flag,
  Mail,
  Link2,
} from 'lucide-react';
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
  const [showRecord, setShowRecord] = useState(false);
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
    });
    const ok = await copyText(link);
    setMemoStatus(ok ? 'Share link copied — read-only, actions only' : 'Copy failed');
    window.setTimeout(() => setMemoStatus(null), 2600);
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

          {priorDebrief && (
            <section
              className="mettle-card mt-3"
              aria-label="Previous debrief for this counterpart"
            >
              <p className="mettle-kicker">
                <ArrowRight size={13} /> From your last conversation ·{' '}
                {new Date(priorDebrief.savedAt).toLocaleDateString()}
              </p>
              <ul className="mettle-list mt-2">
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
          )}
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
              <button className="mettle-icon-action" onClick={downloadMemo} type="button">
                <Download size={14} aria-hidden="true" /> Download
              </button>
              <button
                className="mettle-icon-action"
                onClick={() => void copyShareLink()}
                type="button"
              >
                <Link2 size={14} aria-hidden="true" /> Share link
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
