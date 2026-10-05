'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Brain } from 'lucide-react';

import { counterpartRef } from '@/lib/counterpart-ref';

import styles from './memory-panel.module.css';

type History = {
  counterpart_name?: string;
  commitments: string[];
  assumptions: string[];
  notes: string[];
};

type MemoryResponse = {
  found?: boolean;
  degraded?: boolean;
  reason?: string;
  history?: History;
  deleted?: number;
};

type View =
  | { kind: 'loading' }
  | { kind: 'off' }
  | { kind: 'empty' }
  | { kind: 'known'; history: History }
  | { kind: 'error' };

/**
 * What the agent remembers about a counterpart, with a way to make it forget.
 * Memory is the product's third promise, and a promise to remember needs an
 * equally visible promise to forget.
 *
 * Memory is matched by name only, so a different person with the same name
 * would share a history — the caption says so and Forget resets it.
 */
export function MemoryPanel({ counterpart }: { counterpart: string }) {
  const ref = counterpartRef(counterpart);
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const forgetRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!ref) {
        setView({ kind: 'empty' });
        return;
      }
      try {
        const response = await fetch(`/api/memory/${ref}`, { cache: 'no-store', signal });
        const data = (await response.json()) as MemoryResponse;
        if (data.degraded) setView({ kind: 'off' });
        else if (data.found && data.history) setView({ kind: 'known', history: data.history });
        else setView({ kind: 'empty' });
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') return;
        setView({ kind: 'error' });
      }
    },
    [ref],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  const forget = async () => {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/memory/${ref}`, { method: 'DELETE' });
      const data = (await response.json()) as MemoryResponse;
      if (data.degraded) {
        setMessage('Memory is unavailable, so nothing was changed.');
      } else {
        setMessage(
          data.deleted
            ? `Forgot ${data.deleted} item${data.deleted === 1 ? '' : 's'} about ${counterpart}.`
            : `Nothing to forget about ${counterpart}.`,
        );
        setView({ kind: 'empty' });
      }
    } catch {
      setMessage('Could not reach memory, so nothing was changed.');
    } finally {
      setBusy(false);
      setConfirming(false);
      // Return focus to where the action started so keyboard users keep their place.
      requestAnimationFrame(() => forgetRef.current?.focus());
    }
  };

  const total =
    view.kind === 'known'
      ? view.history.commitments.length +
        view.history.assumptions.length +
        view.history.notes.length
      : 0;

  return (
    <section className={styles.panel} aria-label={`What I remember about ${counterpart}`}>
      <div className={styles.head}>
        <h3 className={styles.title}>
          <Brain size={12} aria-hidden="true" /> What I remember about {counterpart.split(' ')[0]}
        </h3>
        {view.kind === 'known' && !confirming && (
          <button
            ref={forgetRef}
            type="button"
            className={styles.forget}
            onClick={() => setConfirming(true)}
          >
            Forget
          </button>
        )}
      </div>

      {view.kind === 'loading' && <p className={styles.note}>Checking memory…</p>}
      {view.kind === 'off' && (
        <p className={styles.note}>
          Memory is off, so nothing about this conversation is being kept between sessions.
        </p>
      )}
      {view.kind === 'error' && <p className={styles.note}>Couldn&apos;t reach memory just now.</p>}
      {view.kind === 'empty' && (
        <p className={styles.note}>
          Nothing remembered yet. After you debrief, what was committed and what you learned is kept
          here for next time.
        </p>
      )}

      {view.kind === 'known' && (
        <>
          {(
            [
              ['Commitments', view.history.commitments],
              ['Assumptions that changed', view.history.assumptions],
              ['From past debriefs', view.history.notes],
            ] as const
          ).map(([label, items]) =>
            items.length > 0 ? (
              <div key={label}>
                <p className={styles.groupLabel}>{label}</p>
                <ul className={styles.list}>
                  {items.map((item, index) => (
                    <li key={`${label}-${index}`} className={styles.item}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
          <p className={styles.caveat}>
            Matched by name only. If this is a different {counterpart.split(' ')[0]}, forget and
            start fresh.
          </p>
        </>
      )}

      {confirming && (
        <div className={styles.actions} role="group" aria-label="Confirm forgetting">
          <span className={styles.note}>
            Forget all {total} item{total === 1 ? '' : 's'} about {counterpart}? This can&apos;t be
            undone.
          </span>
          <button
            ref={confirmRef}
            type="button"
            className={styles.confirm}
            onClick={forget}
            disabled={busy}
          >
            {busy ? 'Forgetting…' : 'Yes, forget'}
          </button>
          <button
            type="button"
            className={styles.cancel}
            onClick={() => {
              setConfirming(false);
              requestAnimationFrame(() => forgetRef.current?.focus());
            }}
          >
            Cancel
          </button>
        </div>
      )}

      <p role="status" aria-live="polite" className={styles.note}>
        {message}
      </p>
    </section>
  );
}
