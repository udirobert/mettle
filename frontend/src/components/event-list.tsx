'use client';

import { useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Clock,
  Flame,
  IdCard,
  Repeat,
  Shield,
  TrendingUp,
} from 'lucide-react';

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

  const isElena = state.scenario_id === LP_EVENT.id;
  const hasBrief = isElena && !!state.coach_analysis;
  const hasEvidence =
    isElena &&
    state.context_brief?.status === 'approved' &&
    (state.context_brief.claims?.length ?? 0) > 0;

  const fullPrepDetail = !hasEvidence
    ? 'Paste the thread, approve the evidence, build the brief.'
    : !hasBrief
      ? 'Evidence approved. Build the brief.'
      : 'Brief is ready. Spar, then walk in.';

  const pattern = topObjectionPattern(FUND_III);
  const commitments = openCommitments(FUND_III);
  const pipeline = FUND_III.lps.filter((lp) => lp.status !== 'next');

  const briefFor = (event: MettleEvent) =>
    state.scenario_id === event.id ? (state.coach_analysis ?? null) : null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <p className={styles.kicker}>
          {FUND_III.name} raise · {FUND_III.committed} of {FUND_III.target}
        </p>
        <h1 className={styles.title}>The one you cannot afford to wing.</h1>
        <p className={styles.subtitle}>
          Not every meeting. This one. {LP_EVENT.stakes.replace(/\.$/, '')}, two days out.
        </p>
      </header>

      <article className={styles.hero} aria-labelledby="hero-name">
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

        <p className={styles.heroStakes}>{LP_EVENT.stakes.replace(/\.$/, '')}</p>
        <h2 id="hero-name" className={styles.heroName}>
          {LP_EVENT.counterpart}
        </h2>
        <p className={styles.heroRole}>{LP_EVENT.counterpartRole}</p>

        {carryCount > 0 && (
          <div className={styles.carryBadge} aria-label="Open items from your last conversation">
            <Repeat size={13} aria-hidden="true" />
            <span>
              {carryCount} open item{carryCount === 1 ? '' : 's'} carried from your last close-out
              with {firstName(LP_EVENT)}
            </span>
          </div>
        )}

        {pattern && (
          <p className={styles.pattern}>
            <TrendingUp size={13} aria-hidden="true" />
            <span>
              <strong>{pattern.label}</strong> came up with {pattern.count} of the {pattern.of}{' '}
              LPs you&apos;ve met. Expect it from {firstName(LP_EVENT)}.
            </span>
          </p>
        )}

        <div className={styles.when} role="group" aria-labelledby="when-label">
          <p id="when-label" className={styles.whenLabel}>
            How long until you&apos;re in the room?
          </p>
          <div className={styles.whenOptions}>
            <button
              type="button"
              className={styles.whenOption}
              onClick={() => setWalkInEvent(LP_EVENT)}
            >
              <span className={styles.whenTime}>
                <IdCard size={14} aria-hidden="true" /> Minutes
              </span>
              <span className={styles.whenAction}>Walk-in card</span>
              <span className={styles.whenDetail}>Opening, comebacks, one thing to avoid.</span>
            </button>
            <button
              type="button"
              className={styles.whenOption}
              onClick={() => onQuickSpar(LP_EVENT.id)}
            >
              <span className={styles.whenTime}>
                <Flame size={14} aria-hidden="true" /> Hours
              </span>
              <span className={styles.whenAction}>One quick round</span>
              <span className={styles.whenDetail}>
                {firstName(LP_EVENT)} presses on the hardest question.
              </span>
            </button>
            <button
              type="button"
              className={`${styles.whenOption} ${styles.whenPrimary}`}
              onClick={() => onSelectEvent(LP_EVENT.id)}
            >
              <span className={styles.whenTime}>
                <CalendarClock size={14} aria-hidden="true" /> A day or more
              </span>
              <span className={styles.whenAction}>
                Full prep <ArrowRight size={14} aria-hidden="true" />
              </span>
              <span className={styles.whenDetail}>{fullPrepDetail}</span>
            </button>
          </div>
        </div>
      </article>

      <section className={styles.contrast} aria-labelledby="raise-next">
        <div className={styles.sectionHead}>
          <h2 id="raise-next" className={styles.sectionTitle}>
            Also coming up in the raise
          </h2>
          <span className={styles.sectionMeta}>{RAISE_EVENTS.length} conversations</span>
        </div>
        <ul className={styles.eventCards}>
          {RAISE_EVENTS.map((event) => (
            <li key={event.id} className={styles.eventCard}>
              <div className={styles.heroTop}>
                <span className={styles.kindChip} data-kind={event.kind}>
                  {event.kind}
                </span>
                <span className={styles.heroTime}>
                  <Clock size={13} aria-hidden="true" />
                  {event.timeUntil}
                </span>
              </div>
              <span className={styles.eventCardName}>{event.counterpart}</span>
              <span className={styles.contrastDetail}>{event.counterpartRole}</span>
              <span className={styles.eventCardStakes}>{event.stakes}</span>
              <div className={styles.eventCardActions}>
                <button
                  type="button"
                  className={styles.cardAction}
                  onClick={() => setWalkInEvent(event)}
                  aria-label={`Walk-in card for ${event.counterpart}`}
                >
                  <IdCard size={13} aria-hidden="true" /> Card
                </button>
                <button
                  type="button"
                  className={styles.cardAction}
                  onClick={() => onQuickSpar(event.id)}
                  aria-label={`One quick round with ${event.counterpart}`}
                >
                  <Flame size={13} aria-hidden="true" /> Spar
                </button>
                <button
                  type="button"
                  className={`${styles.cardAction} ${styles.cardActionPrimary}`}
                  onClick={() => onSelectEvent(event.id)}
                  aria-label={`Full prep for ${event.counterpart}`}
                >
                  Prep <ArrowRight size={13} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className={styles.contrast}>
        <Fold
          label={`Across the ${FUND_III.name} raise`}
          meta={`${pipeline.length} LPs · ${commitments.length} open promises`}
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
        </Fold>
      </div>

      <div className={styles.contrast}>
        <Fold label="Beyond the raise" meta={`${SECONDARY_EVENTS.length} conversations`}>
          <ul className={styles.eventCards}>
            {SECONDARY_EVENTS.map((event) => (
              <li key={event.id}>
                <button
                  className={styles.eventCardButton}
                  onClick={() => onSelectEvent(event.id)}
                  aria-label={`Open ${event.name} with ${event.counterpart}`}
                  type="button"
                >
                  <div className={styles.heroTop}>
                    <span className={styles.kindChip}>{event.kind}</span>
                    <span className={styles.heroTime}>
                      <Clock size={13} aria-hidden="true" />
                      {event.timeUntil}
                    </span>
                  </div>
                  <span className={styles.eventCardName}>{event.name}</span>
                  <span className={styles.contrastDetail}>
                    {event.counterpart} · {event.stakes}
                  </span>
                  <span className={styles.eventCardCta}>
                    <ArrowRight size={13} aria-hidden="true" /> Prep this
                  </span>
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
        />
      )}
    </div>
  );
}
