'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Brain } from 'lucide-react';

import { clearLocalMemory, memoryRefCandidates, readCarryCount } from '@/lib/counterpart-identity';

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

type Known = { ref: string; confirmed: boolean; history: History };

type View =
  | { kind: 'loading' }
  | { kind: 'off' }
  | { kind: 'empty' }
  | { kind: 'known'; found: Known }
  | { kind: 'error' };

/**
 * What the agent remembers about a counterpart, with a way to make it forget.
 * Memory is the product's third promise, and a promise to remember needs an
 * equally visible promise to forget.
 *
 * Memory is matched by name only, so a different person with the same name
 * would share a history — the caption says so and Forget resets it.
 */
export function MemoryPanel({
  counterpart,
  organization,
  onForgotten,
}: {
  counterpart: string;
  /** Where they work. Without it, memory can only be matched by name. */
  organization?: string;
  /** Called after a Forget, so the page can drop anything derived from memory. */
  onForgotten?: () => void;
}) {
  const candidates = memoryRefCandidates(counterpart, organization);
  const candidateKey = candidates.map((c) => c.ref).join('|');
  const first = counterpart.split(' ')[0];
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [localCarried, setLocalCarried] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const forgetRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLocalCarried(
          candidates.length ? readCarryCount(window.localStorage, candidates[0].ref) : 0,
        );
      } catch {
        setLocalCarried(0);
      }
      // Most specific record first; the name-only one is the pre-organisation fallback.
      for (const { ref, confirmed } of candidates) {
        try {
          const response = await fetch(`/api/memory/${ref}`, { cache: 'no-store', signal });
          const data = (await response.json()) as MemoryResponse;
          if (data.degraded) return setView({ kind: 'off' });
          if (data.found && data.history) {
            return setView({ kind: 'known', found: { ref, confirmed, history: data.history } });
          }
        } catch (error) {
          if ((error as { name?: string })?.name === 'AbortError') return;
          return setView({ kind: 'error' });
        }
      }
      setView({ kind: 'empty' });
    },
    // `candidateKey` stands in for `candidates`, which is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidateKey],
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
      let deleted = 0;
      if (view.kind === 'known') {
        const response = await fetch(`/api/memory/${view.found.ref}`, { method: 'DELETE' });
        const data = (await response.json()) as MemoryResponse;
        if (data.degraded) {
          setMessage('Memory is unavailable, so nothing was changed.');
          return;
        }
        deleted = data.deleted ?? 0;
      }
      // The same person's browser-local copies go too: the carried-over open
      // items and the saved debrief. Forgetting must be all-or-nothing.
      let carried = 0;
      try {
        for (const { ref } of candidates.slice(0, 1)) {
          carried += clearLocalMemory(window.localStorage, ref);
        }
        if (view.kind === 'known') carried += clearLocalMemory(window.localStorage, view.found.ref);
      } catch {
        /* storage unavailable */
      }
      const parts = [
        deleted ? `${deleted} remembered item${deleted === 1 ? '' : 's'}` : null,
        carried ? `${carried} carried-over item${carried === 1 ? '' : 's'} on this device` : null,
      ].filter(Boolean);
      setMessage(
        parts.length
          ? `Forgot ${parts.join(' and ')} about ${counterpart}.`
          : `Nothing to forget about ${counterpart}.`,
      );
      onForgotten?.();
      // Re-read rather than assume: an older, unconfirmed name-only record may
      // remain, and the panel should say so instead of claiming an empty slate.
      await load();
    } catch {
      setMessage('Could not reach memory, so nothing was changed.');
    } finally {
      setBusy(false);
      setConfirming(false);
      // Keep keyboard users' place: back on Forget if it is still there,
      // otherwise on the panel heading (Forget disappears once nothing is left).
      requestAnimationFrame(() => (forgetRef.current ?? titleRef.current)?.focus());
    }
  };

  const known = view.kind === 'known' ? view.found : null;
  const remembered = known
    ? known.history.commitments.length +
      known.history.assumptions.length +
      known.history.notes.length
    : 0;
  const total = remembered + localCarried;
  const canForget = Boolean(known) || localCarried > 0;

  // Say honestly how sure we are that this record is the same person.
  const matchNote = known
    ? known.confirmed
      ? `Matched by name and organisation${organization ? ` (${organization})` : ''}.`
      : organization
        ? `Matched by name only — this record predates organisations, so it may not be the same ${first}. Forget it to start fresh.`
        : `Matched by name only. If this is a different ${first}, forget and start fresh.`
    : '';

  return (
    <section className={styles.panel} aria-label={`What I remember about ${counterpart}`}>
      <div className={styles.head}>
        <h3 ref={titleRef} tabIndex={-1} className={styles.title}>
          <Brain size={12} aria-hidden="true" /> What I remember about {first}
        </h3>
        {canForget && !confirming && (
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

      {known && (
        <>
          {(
            [
              ['Commitments', known.history.commitments],
              ['Assumptions that changed', known.history.assumptions],
              ['From past debriefs', known.history.notes],
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
          <p className={styles.caveat}>{matchNote}</p>
        </>
      )}

      {localCarried > 0 && (
        <p className={styles.note}>
          On this device: {localCarried} open item{localCarried === 1 ? '' : 's'} carried over from
          your last debrief.
        </p>
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
