'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Copy, Inbox, RefreshCw } from 'lucide-react';

import type { ConversationStateUpdate } from '@/hooks/use-conversation-state';
import { draftToState, parseInboxImport, type InboxDraft } from '@/lib/inbox-draft';
import { SourceChip } from '@/components/source-chip';

import styles from './inbox-draft-card.module.css';

/**
 * "Conversations find you": a thread forwarded to the agent's own inbox shows
 * up on the docket as a draft event. Three honest states:
 *   live   — real mail arrived
 *   sample — no inbox yet; the bundled thread is offered, labelled as a sample
 *   empty  — nothing yet; shows the address to forward to
 * Opening a draft never approves anything: every claim stays pending.
 */
export function InboxDraftCard({ onOpen }: { onOpen: (update: ConversationStateUpdate) => void }) {
  const [draft, setDraft] = useState<InboxDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch('/api/agent/context/import', { method: 'POST', signal });
      const json = await response.json().catch(() => null);
      setDraft(parseInboxImport(json));
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return;
      setDraft(parseInboxImport(null));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the address is visible and selectable anyway.
    }
  };

  if (loading && !draft) {
    return (
      <section className={styles.card} aria-label="From your inbox" aria-busy="true">
        <p className={styles.kicker}>From your inbox</p>
        <div className={styles.skeleton} />
        <span role="status" className="sr-only">
          Checking your agent&apos;s inbox…
        </span>
      </section>
    );
  }

  if (!draft) return null;

  if (draft.kind === 'empty') {
    const reason = /unreachable/i.test(draft.reason)
      ? 'The agent backend is not reachable right now.'
      : draft.reason;
    return (
      <section className={styles.card} aria-label="From your inbox">
        <div className={styles.top}>
          <p className={styles.kicker}>
            <Inbox size={12} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> From your inbox
          </p>
          <SourceChip source={{ kind: 'none', label: 'Nothing yet', hint: reason }} />
        </div>
        <p className={styles.stakes}>
          Forward the email thread to your agent and the conversation will appear here, ready to
          prepare.
        </p>
        {draft.address && (
          <div className={styles.actions}>
            <code className={styles.address}>{draft.address}</code>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => copyAddress(draft.address!)}
            >
              <Copy size={13} aria-hidden="true" /> {copied ? 'Copied' : 'Copy address'}
            </button>
          </div>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={13} aria-hidden="true" /> {loading ? 'Checking…' : 'Check again'}
          </button>
          <span className={styles.meta}>{reason}</span>
        </div>
      </section>
    );
  }

  const live = draft.kind === 'live';
  return (
    <section
      className={`${styles.card} ${live ? styles.cardLive : styles.cardSample}`}
      aria-label={live ? 'From your inbox' : 'Sample thread'}
    >
      <div className={styles.top}>
        <p className={styles.kicker}>
          <Inbox size={12} aria-hidden="true" style={{ verticalAlign: '-2px' }} />{' '}
          {live ? 'From your inbox' : 'Try it with a sample thread'}
        </p>
        <SourceChip
          source={
            live
              ? { kind: 'live', label: 'Live', hint: 'Read from mail sent to your agent.' }
              : {
                  kind: 'sample',
                  label: 'Sample thread',
                  hint: 'No real mail yet — this is a bundled example, not your inbox.',
                }
          }
        />
      </div>

      <div>
        <h2 className={styles.who}>{draft.counterpart}</h2>
        {draft.role && <p className={styles.role}>{draft.role}</p>}
      </div>
      {draft.stakes && <p className={styles.stakes}>{draft.stakes}</p>}
      <p className={styles.meta}>
        {draft.claimCount} claim{draft.claimCount === 1 ? '' : 's'} drafted · all pending your
        keep/reject
      </p>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          onClick={() => onOpen(draftToState(draft))}
        >
          Prepare this <ArrowRight size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={13} aria-hidden="true" /> {loading ? 'Checking…' : 'Check again'}
        </button>
      </div>
    </section>
  );
}
