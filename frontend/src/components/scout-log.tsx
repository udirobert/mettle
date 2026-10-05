'use client';

import { useState } from 'react';
import {
  AtSign,
  Brain,
  ChevronDown,
  Globe,
  Inbox,
  Link2,
  Sparkles,
  StickyNote,
} from 'lucide-react';

import type { EvidenceClaim, ScoutEvent } from '@/hooks/use-conversation-state';
import type { SourceDescription } from '@/lib/scout-status';
import { SourceChip } from '@/components/source-chip';

import styles from './scout-log.module.css';

/**
 * Provenance is the product's credibility mechanic. A claim the agent asserts
 * must be traceable to where it came from, so every claim the Coach sees wears
 * a badge naming its origin: the user's own inbox, the public web, the agent's
 * memory of an earlier conversation, or the user themself.
 */
const PROVENANCE_META = {
  inbox: { label: 'inbox', Icon: Inbox, hint: 'From a thread in your inbox' },
  web: { label: 'web', Icon: Globe, hint: 'From public research' },
  memory: { label: 'memory', Icon: Brain, hint: 'From an earlier conversation with them' },
  paste: { label: 'pasted', Icon: StickyNote, hint: 'You pasted this in' },
  stated: { label: 'you', Icon: AtSign, hint: 'You said this yourself' },
} as const satisfies Record<
  NonNullable<EvidenceClaim['provenance']>,
  { label: string; Icon: typeof Inbox; hint: string }
>;

export function ProvenanceBadge({
  provenance,
  compact = false,
}: {
  provenance: EvidenceClaim['provenance'];
  compact?: boolean;
}) {
  // Claims from the pre-provenance fixtures carry no origin — say so honestly
  // rather than guessing one.
  if (!provenance) {
    return (
      <span className={`${styles.badge} ${styles.badgeUnknown}`} title="Origin not recorded">
        <Link2 size={compact ? 10 : 11} aria-hidden="true" />
        {compact ? null : 'unattributed'}
      </span>
    );
  }

  const { label, Icon, hint } = PROVENANCE_META[provenance];
  return (
    <span className={`${styles.badge} ${styles[`badge_${provenance}`]}`} title={hint}>
      <Icon size={compact ? 10 : 11} aria-hidden="true" />
      {compact ? null : label}
      <span className="sr-only"> — {hint}</span>
    </span>
  );
}

function formatTime(ts: string): string {
  const parsed = new Date(ts);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * The Scout's work log. The demo's point is that something happened before the
 * user opened the app.
 *
 * Collapsed by default with the step count visible: research on agentic
 * transparency is clear that an always-visible activity log reads as
 * overwhelming, while "3 steps before you arrived" still communicates that the
 * agent was busy. Trust comes from knowing you can verify, not being forced to.
 */
export function ScoutLog({
  events,
  title = 'Scout',
  emptyHint,
  defaultOpen = false,
  source,
}: {
  events: ScoutEvent[];
  title?: string;
  emptyHint?: string;
  defaultOpen?: boolean;
  /** Where these events came from (live / sample / degraded). Shown as a chip. */
  source?: SourceDescription;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (events.length === 0) {
    if (!emptyHint) return null;
    return (
      <section className={styles.log} aria-label="Scout activity">
        <p className={styles.logEmpty}>{emptyHint}</p>
      </section>
    );
  }

  const sources = new Set(events.flatMap((event) => event.sources ?? []));

  return (
    <section className={styles.log} aria-label="Scout activity">
      <button
        type="button"
        className={styles.logToggle}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className={styles.logTitle}>
          <Sparkles size={12} aria-hidden="true" /> {title}
        </span>
        {source && <SourceChip source={source} />}
        <span className={styles.logCount}>
          {events.length} step{events.length === 1 ? '' : 's'}
          {source?.kind === 'sample' ? '' : ' before you arrived'}
        </span>
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={`${styles.logToggleChevron} ${open ? styles.logToggleChevronOpen : ''}`}
        />
      </button>

      {open && (
        <>
          <ol className={styles.logList}>
            {events.map((event, index) => (
              <li key={`${event.ts}-${index}`} className={styles.logRow}>
                <span className={styles.logDot} aria-hidden="true" />
                <div className={styles.logBody}>
                  <div className={styles.logRowTop}>
                    <strong>{event.action}</strong>
                    <time dateTime={event.ts}>{formatTime(event.ts)}</time>
                  </div>
                  <p>{event.detail}</p>
                  {(event.sources?.length ?? 0) > 0 && (
                    <div className={styles.logSources}>
                      {event.sources?.map((source) => (
                        <ProvenanceBadge
                          key={source}
                          compact
                          provenance={source as EvidenceClaim['provenance']}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {sources.size > 0 && (
            <p className={styles.logFoot}>
              Read your thread · pulled public research · checked what it remembers
            </p>
          )}
        </>
      )}
    </section>
  );
}
