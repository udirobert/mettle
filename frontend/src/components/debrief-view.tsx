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
import { withDemoParam } from '@/lib/demo';

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
  const [memoTo, setMemoTo] = useState('');
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
  const [sending, setSending] = useState(false);
  const transcript = state.transcript ?? [];
  const nudges = state.nudges_sent ?? [];
  const counterpartFull =
    typeof state.counterpart_profile?.name === 'string'
      ? state.counterpart_profile.name
      : 'Counterpart';
  const counterpartName = counterpartFull.split(' ')[0] || 'Counterpart';

  // The memo comes back to the user, not to the agent's own inbox — but the
  // agent can only send to an address it knows, so the user's forward-path
  // address (the From of the thread they forwarded) is the right destination.
  const memoRecipient = memoTo ?? '';

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

  // Quote-backed commitments: when the debrief node ran, only notes with a
  // verbatim transcript line count as commitments. Commitment-shaped notes
  // without one are still open, not locked in. Older runs have no field —
  // fall back to keyword classification.
  const verified = state.debrief_commitments;
  const verifiedTexts = new Set((verified ?? []).map((c) => c.text));
  const nextNotes = notes.filter((note) => classifyNote(note) === 'next');
  const commitmentNotes = verified
    ? verified.map((c) => c.text)
    : notes.filter((note) => classifyNote(note) === 'commitment');
  const assumptionNotes = notes.filter((note) => {
    const kind = classifyNote(note);
    if (kind === 'assumption') return true;
    return verified ? kind === 'commitment' && !verifiedTexts.has(note) : false;
  });
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

  /**
   * The agent emails the memo itself — the point is that the follow-up does not
   * depend on the user remembering to send it. The backend answers 200 with
   * `degraded: true` when AgentMail is unconfigured, so fall back to the mailto
   * handoff rather than showing a failure the user has to interpret.
   */
  const sendViaAgent = async () => {
    if (sending) return;
    setSending(true);
    setMemoStatus('Sending…');
    try {
      const response = await fetch(withDemoParam('/api/agent/debrief/memo'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: memoRecipient,
          subject: memo.subject,
          // MemoRequest carries notes, not a rendered body — the backend joins
          // them into the email body itself.
          notes: [
            ...(lead ? [lead] : []),
            ...commitmentNotes,
            ...assumptionNotes,
            ...nextNotes.slice(1),
          ],
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        sent?: boolean;
        degraded?: boolean;
        message_id?: string;
      };

      if (result.sent) {
        setMemoStatus('Memo sent — check your inbox');
      } else if (result.degraded) {
        setMemoStatus('Email not configured — opening your mail client instead');
        sendMemo();
      } else {
        setMemoStatus('Send failed — opening your mail client instead');
        sendMemo();
      }
    } catch {
      setMemoStatus('Agent unreachable — opening your mail client instead');
      sendMemo();
    } finally {
      setSending(false);
      window.setTimeout(() => setMemoStatus(null), 3200);
    }
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
        <p className="mettle-kicker">After the room</p>
        <h2 className="mettle-headline">Leave with the next move, not a transcript.</h2>
      </header>

      {(() => {
        const source = state.conversation_source === 'rehearsal' ? 'rehearsal' : 'live';
        return (
          <p className="mettle-premise">
            {source === 'rehearsal' ? (
              <>
                This debrief reads a <strong>rehearsal</strong> — so treat commitments here as{' '}
                <em>intended lines</em>, not promises made. What you actually said in the room is
                the record that counts.
              </>
            ) : (
              <>
                This debrief reads a <strong>live conversation</strong> — commitments below were
                said out loud, to {counterpartName}. They are real and owed.
              </>
            )}
          </p>
        );
      })()}

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
              <Mail size={13} /> The memo
            </p>
            <strong>
              It emails you the follow-up — you don&apos;t have to remember to send it.
            </strong>
            <p className="mt-2">
              Commitments, what stayed open, and the next move. No live record attached.
            </p>

            <label className="mt-3 block text-xs font-mono font-bold uppercase tracking-wide text-[var(--ink-soft)]">
              Send it to
              <input
                className="mettle-input mt-1 w-full"
                type="email"
                value={memoTo}
                onChange={(event) => setMemoTo(event.target.value)}
                placeholder="you@company.com"
                aria-label="Email address to send the memo to"
              />
            </label>

            <div className="flex flex-wrap gap-2 mt-3">
              <button
                className="mettle-action"
                disabled={sending || !memoTo.trim()}
                onClick={() => void sendViaAgent()}
                type="button"
                title={
                  memoTo.trim()
                    ? 'Mettle emails this memo from its own inbox'
                    : 'Add the address to send the memo to'
                }
              >
                <Mail size={14} aria-hidden="true" />
                {sending ? 'Sending…' : 'Send me the memo'}
              </button>
              <button className="mettle-icon-action" onClick={sendMemo} type="button">
                Open in my mail app
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
                {commitmentNotes.map((note, index) => {
                  const backing = verified?.find((c) => c.text === note);
                  return (
                    <div className="mettle-card" key={`commit-${index}`}>
                      <p className="mettle-kicker">
                        <CheckCircle2 size={13} /> Locked in
                      </p>
                      <strong>{note}</strong>
                      {backing && (
                        <p className="mt-2 text-xs italic text-[var(--ink-soft)]">
                          &ldquo;{backing.quote}&rdquo; — {backing.speaker}
                        </p>
                      )}
                    </div>
                  );
                })}
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
