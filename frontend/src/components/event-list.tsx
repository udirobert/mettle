'use client';

import { useState, type CSSProperties } from 'react';
import { ArrowRight, CalendarClock, Clock, Flame, IdCard, Repeat, Shield } from 'lucide-react';

import {
  FUND_III,
  OBJECTION_LABELS,
  openCommitments,
  topObjectionPattern,
  type LpStatus,
} from '@/fixtures/fundraise';
import {
  LP_EVENT,
  RAISE_EVENTS,
  SECONDARY_EVENTS,
  type MettleEvent,
} from '@/fixtures/lp-event';
import { useConversationState } from '@/hooks/use-conversation-state';
import { Fold } from '@/components/fold';
import { WalkInCard } from '@/components/walk-in-card';

import styles from './event-list.module.css';

const STATUS_LABELS: Record<LpStatus, string> = {
  committed: 'Committed',
  met: 'In diligence',
  next: 'Next',
  scheduled: 'Scheduled',
};

/** Carry-forward marker: open items persisted by a previous debrief with this counterpart. */
function readCarryCount(counterpart: string): number {
  try {
    const raw = window.localStorage.getItem(
      `mettle.carry.${counterpart.toLowerCase().replace(/\s+/g, '-')}`,
    );
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { items?: string[] };
    return parsed.items?.length ?? 0;
  } catch {
    return 0;
  }
}

function firstName(event: MettleEvent) {
  return event.counterpart.split(' ')[0];
}

function amount(value: string) {
  return Number.parseFloat(value.replace(/[^\d.]/g, '')) || 0;
}

/** Staggered entrance order; CSS reads --i for the delay. */
function reveal(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}

export function EventList({
  onSelectEvent,
  onQuickSpar,
}: {
  onSelectEvent: (scenarioId: string) => void;
  onQuickSpar: (scenarioId: string) => void;
}) {
  const { state } = useConversationState();
  const [carryCount] = useState(() => readCarryCount(LP_EVENT.counterpart));
  const [walkInEvent, setWalkInEvent] = useState<MettleEvent | null>(null);

  const pattern = topObjectionPattern(FUND_III);
  const commitments = openCommitments(FUND_III);
  const pipeline = FUND_III.lps.filter((lp) => lp.status !== 'next');
  const raisedPct = Math.min(
    100,
    Math.round((amount(FUND_III.committed) / amount(FUND_III.target)) * 100),
  );

  const briefFor = (event: MettleEvent) =>
    state.scenario_id === event.id ? (state.coach_analysis ?? null) : null;

  return (
    <div className={styles.container}>
      <header className={`${styles.header} ${styles.reveal}`} style={reveal(0)}>
        <div className={styles.raiseLine}>
          <span className={styles.kicker}>{FUND_III.name} raise</span>
          <span className={styles.raiseAmount}>
            {FUND_III.committed} <span>/ {FUND_III.target}</span>
          </span>
        </div>
        <div
          className={styles.raiseBar}
          role="progressbar"
          aria-label={`${FUND_III.name} raised`}
          aria-valuenow={raisedPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ '--pct': `${raisedPct}%` } as CSSProperties} />
        </div>
      </header>

      <article className={`${styles.hero} ${styles.reveal}`} style={reveal(1)} aria-labelledby="hero-name">
        <div className={styles.heroTop}>
          <span className={styles.heroTime}>
            <Clock size={14} aria-hidden="true" />
            {LP_EVENT.timeUntil}
          </span>
          <span className={styles.heroRisk}>
            <Shield size={13} aria-hidden="true" />
            {LP_EVENT.risk} risk
          </span>
        </div>

        <p className={styles.heroStakes}>{LP_EVENT.kind}</p>
        <h1 id="hero-name" className={styles.heroName}>
          {LP_EVENT.counterpart}
        </h1>
        <p className={styles.heroRole}>{LP_EVENT.counterpartRole}</p>

        {pattern && (
          <div
            className={styles.pattern}
            aria-label={`${pattern.label} came up with ${pattern.count} of ${pattern.of} LPs met. Expect it from ${firstName(LP_EVENT)}.`}
          >
            <span className={styles.patternDots} aria-hidden="true">
              {Array.from({ length: pattern.of }, (_, index) => (
                <span
                  key={index}
                  className={index < pattern.count ? styles.dotHit : styles.dot}
                  style={reveal(index)}
                />
              ))}
            </span>
            <span aria-hidden="true">
              <strong>{pattern.label}</strong> · {pattern.count} of {pattern.of} LPs asked
            </span>
          </div>
        )}

        {carryCount > 0 && (
          <p className={styles.carryBadge}>
            <Repeat size={13} aria-hidden="true" />
            {carryCount} carried from last time
          </p>
        )}

        <div className={styles.when} role="group" aria-labelledby="when-label">
          <p id="when-label" className={styles.whenLabel}>
            In the room in…
          </p>
          <div className={styles.whenOptions}>
            <button
              type="button"
              className={styles.whenOption}
              onClick={() => setWalkInEvent(LP_EVENT)}
            >
              <IdCard size={18} aria-hidden="true" />
              <span className={styles.whenTime}>Minutes</span>
              <span className={styles.whenAction}>Card</span>
            </button>
            <button
              type="button"
              className={styles.whenOption}
              onClick={() => onQuickSpar(LP_EVENT.id)}
            >
              <Flame size={18} aria-hidden="true" />
              <span className={styles.whenTime}>Hours</span>
              <span className={styles.whenAction}>Spar</span>
            </button>
            <button
              type="button"
              className={`${styles.whenOption} ${styles.whenPrimary}`}
              onClick={() => onSelectEvent(LP_EVENT.id)}
            >
              <CalendarClock size={18} aria-hidden="true" />
              <span className={styles.whenTime}>Days</span>
              <span className={styles.whenAction}>
                Prep <ArrowRight size={14} aria-hidden="true" />
              </span>
            </button>
          </div>
        </div>
      </article>

      <section className={`${styles.contrast} ${styles.reveal}`} style={reveal(2)} aria-labelledby="raise-next">
        <h2 id="raise-next" className={styles.sectionTitle}>
          Up next
        </h2>
        <ul className={styles.eventCards}>
          {RAISE_EVENTS.map((event, index) => (
            <li key={event.id} className={styles.reveal} style={reveal(3 + index)}>
              <button
                type="button"
                className={styles.eventCardButton}
                onClick={() => setWalkInEvent(event)}
                aria-label={`${event.kind}: ${event.counterpart}, ${event.timeUntil}. Open walk-in card.`}
              >
                <span className={styles.heroTop}>
                  <span className={styles.kindChip} data-kind={event.kind}>
                    {event.kind}
                  </span>
                  <span className={styles.heroTime}>{event.timeUntil}</span>
                </span>
                <span className={styles.eventCardName}>{event.counterpart}</span>
                <span className={styles.contrastDetail}>
                  {event.counterpartRole.split(', ').pop()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className={`${styles.contrast} ${styles.reveal}`} style={reveal(8)}>
        <Fold
          label="Full raise"
          meta={`${pipeline.length} LPs · ${commitments.length} owed · ${SECONDARY_EVENTS.length} other`}
        >
          <ul className={styles.pipeline} aria-label="LP pipeline">
            {pipeline.map((lp) => (
              <li key={lp.name} className={styles.pipelineRow}>
                <span className={styles.pipelineWho}>
                  <strong>{lp.name}</strong>
                  <span className={styles.contrastDetail}>{lp.org}</span>
                </span>
                <span className={styles.pipelineThemes}>
                  {lp.objections.length > 0
                    ? lp.objections.map((theme) => OBJECTION_LABELS[theme]).join(' · ')
                    : 'Not met yet'}
                  {lp.openCommitment && (
                    <span className={styles.pipelinePromise}>Owed: {lp.openCommitment}</span>
                  )}
                </span>
                <span className={styles.pipelineStatus} data-status={lp.status}>
                  {STATUS_LABELS[lp.status]}
                </span>
              </li>
            ))}
          </ul>

          <p className={styles.subhead}>Beyond the raise</p>
          <ul className={styles.otherList}>
            {SECONDARY_EVENTS.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  className={styles.otherRow}
                  onClick={() => setWalkInEvent(event)}
                  aria-label={`${event.name} with ${event.counterpart}. Open walk-in card.`}
                >
                  <span className={styles.kindChip}>{event.kind}</span>
                  <strong>{event.counterpart}</strong>
                  <span className={styles.contrastDetail}>{event.timeUntil}</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </Fold>
      </div>

      {walkInEvent && (
        <WalkInCard
          event={walkInEvent}
          analysis={briefFor(walkInEvent)}
          onClose={() => setWalkInEvent(null)}
          onSpar={() => {
            const id = walkInEvent.id;
            setWalkInEvent(null);
            onQuickSpar(id);
          }}
          onPrep={() => {
            const id = walkInEvent.id;
            setWalkInEvent(null);
            onSelectEvent(id);
          }}
        />
      )}
    </div>
  );
}
