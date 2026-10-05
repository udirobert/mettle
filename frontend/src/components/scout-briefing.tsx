'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';

import type { ScoutEvent } from '@/hooks/use-conversation-state';

import styles from './scout-briefing.module.css';

type Awaiting = {
  runId: string;
  title: string;
  summary: string;
  scout_log: ScoutEvent[];
};

type Phase =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'awaiting'; brief: Awaiting }
  | { kind: 'deciding'; brief: Awaiting }
  | { kind: 'done'; released: boolean }
  | { kind: 'off' }
  | { kind: 'error' };

type BriefResponse = {
  degraded?: boolean;
  runId?: string;
  status?: 'awaiting_approval' | 'done' | 'failed';
  title?: string;
  summary?: string;
  scout_log?: ScoutEvent[];
  released?: boolean;
};

/**
 * The approval gate for Scout's pre-arrival briefing. Scout drafts; the user
 * decides. The decision is stored server-side, so it survives a restart.
 *
 * The card says exactly what releasing does (and does not do) before the user
 * commits: nothing reaches the Coach either way — every claim still needs an
 * explicit keep/reject.
 */
export function ScoutBriefing({
  onRelease,
}: {
  /** Called with the Scout's log when the user releases the draft. */
  onRelease: (events: ScoutEvent[]) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const awaiting = phase.kind === 'awaiting' || phase.kind === 'deciding';

  // Move focus into the card when it appears, and back to the trigger after.
  useEffect(() => {
    if (phase.kind === 'awaiting') headingRef.current?.focus();
    if (phase.kind === 'done' || phase.kind === 'off' || phase.kind === 'error') {
      triggerRef.current?.focus();
    }
  }, [phase.kind]);

  const start = async () => {
    setPhase({ kind: 'running' });
    try {
      const response = await fetch('/api/scout/brief', { method: 'POST' });
      const data = (await response.json()) as BriefResponse;
      if (data.degraded) return setPhase({ kind: 'off' });
      if (data.status === 'awaiting_approval' && data.runId) {
        return setPhase({
          kind: 'awaiting',
          brief: {
            runId: data.runId,
            title: data.title ?? 'Scout has a draft brief ready',
            summary: data.summary ?? '',
            scout_log: data.scout_log ?? [],
          },
        });
      }
      setPhase({ kind: 'error' });
    } catch {
      setPhase({ kind: 'error' });
    }
  };

  const decide = async (approved: boolean) => {
    if (phase.kind !== 'awaiting') return;
    const { brief } = phase;
    setPhase({ kind: 'deciding', brief });
    try {
      const response = await fetch(`/api/scout/brief/${brief.runId}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approved }),
      });
      const data = (await response.json()) as BriefResponse;
      if (data.degraded) return setPhase({ kind: 'off' });
      if (data.status !== 'done') return setPhase({ kind: 'error' });
      if (data.released && data.scout_log) onRelease(data.scout_log);
      setPhase({ kind: 'done', released: Boolean(data.released) });
    } catch {
      setPhase({ kind: 'error' });
    }
  };

  return (
    <div className={styles.wrap}>
      {!awaiting && (
        <button
          ref={triggerRef}
          type="button"
          className={styles.trigger}
          onClick={start}
          disabled={phase.kind === 'running'}
        >
          <Sparkles size={13} aria-hidden="true" />
          {phase.kind === 'running' ? 'Scout is reading…' : 'Have Scout prepare a brief'}
        </button>
      )}

      {awaiting && (
        <section
          role="alertdialog"
          aria-modal="false"
          aria-labelledby="scout-brief-title"
          aria-describedby="scout-brief-desc"
          className={styles.card}
        >
          <h3 id="scout-brief-title" ref={headingRef} tabIndex={-1} className={styles.heading}>
            {phase.brief.title}
          </h3>
          <div id="scout-brief-desc" style={{ display: 'contents' }}>
            {phase.brief.summary && <p className={styles.summary}>{phase.brief.summary}</p>}
            <div className={styles.consequences}>
              <p>
                <strong>If you release it:</strong> Scout&apos;s log is added to this event so you
                can see what it did.
              </p>
              <p>
                <strong>If you discard it:</strong> nothing is kept.
              </p>
              <p>
                <strong>Either way:</strong> the Coach sees nothing until you keep or reject each
                claim yourself.
              </p>
            </div>
          </div>
          {phase.brief.scout_log.length > 0 && (
            <ul className={styles.events} aria-label="What Scout did">
              {phase.brief.scout_log.map((event, index) => (
                <li key={`${event.ts}-${index}`}>{event.detail}</li>
              ))}
            </ul>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.release}
              onClick={() => decide(true)}
              disabled={phase.kind === 'deciding'}
            >
              {phase.kind === 'deciding' ? 'Saving…' : 'Release to this event'}
            </button>
            <button
              type="button"
              className={styles.discard}
              onClick={() => decide(false)}
              disabled={phase.kind === 'deciding'}
            >
              Discard
            </button>
          </div>
        </section>
      )}

      <p role="status" aria-live="polite" className={styles.result}>
        {phase.kind === 'done' &&
          (phase.released
            ? 'Released. Scout’s log is on this event — claims still need your keep/reject.'
            : 'Discarded. Nothing was kept.')}
        {phase.kind === 'off' && 'Scout is offline, so there is no briefing to prepare right now.'}
        {phase.kind === 'error' && 'Something went wrong with the briefing. Nothing was changed.'}
      </p>
    </div>
  );
}
