'use client';

import { useState } from 'react';
import { ArrowRight, Clock, Repeat, Shield, User, Zap } from 'lucide-react';

import { LP_EVENT, SECONDARY_EVENTS } from '@/fixtures/lp-event';
import { useConversationState } from '@/hooks/use-conversation-state';
import { Fold } from '@/components/fold';

import styles from './event-list.module.css';

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

export function EventList({
  onSelectEvent,
  onQuickRehearsal,
}: {
  onSelectEvent: (scenarioId: string) => void;
  onQuickRehearsal?: () => void;
}) {
  const { state } = useConversationState();
  const [carryCount] = useState(() => readCarryCount(LP_EVENT.counterpart));

  const isElena = state.scenario_id === LP_EVENT.id;
  const hasBrief = isElena && !!state.coach_analysis;
  const hasEvidence =
    isElena &&
    state.context_brief?.status === 'approved' &&
    (state.context_brief.claims?.length ?? 0) > 0;
  const prepIncomplete = !hasBrief;

  const nextMove = !hasEvidence
    ? 'Paste the thread with Elena, then run Coach.'
    : !hasBrief
      ? 'Evidence is approved. Run Coach.'
      : 'Open Coach — then rehearse with Elena.';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <p className={styles.kicker}>Your consequential conversation</p>
        <h1 className={styles.title}>The one you cannot afford to wing.</h1>
        <p className={styles.subtitle}>
          Not every meeting. This one. {LP_EVENT.stakes.replace(/\.$/, '')}, two days out.
        </p>
      </header>

      {onQuickRehearsal && (
        <button
          className={styles.quickRehearsal}
          onClick={onQuickRehearsal}
          type="button"
          aria-label="Skip setup and try a 60-second rehearsal with the sample counterpart"
        >
          <Zap size={15} aria-hidden="true" />
          <span>
            <strong>No setup — feel it first.</strong> Jump straight into a 60-second rehearsal.
          </span>
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      )}

      <button
        className={styles.hero}
        onClick={() => onSelectEvent(LP_EVENT.id)}
        aria-label={`Open ${LP_EVENT.name} with ${LP_EVENT.counterpart}`}
        type="button"
      >
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
        <h2 className={styles.heroName}>{LP_EVENT.counterpart}</h2>
        <p className={styles.heroRole}>{LP_EVENT.counterpartRole}</p>

        <div className={styles.heroMeta}>
          <span className={styles.heroCounterpart}>
            <User size={14} aria-hidden="true" />
            {LP_EVENT.name}
          </span>
          <span className={prepIncomplete ? styles.prepIncomplete : styles.prepReady}>
            {prepIncomplete ? 'Prep incomplete' : 'Brief ready'}
          </span>
        </div>

        {carryCount > 0 && (
          <div className={styles.carryBadge} aria-label="Open items from your last conversation">
            <Repeat size={13} aria-hidden="true" />
            <span>
              {carryCount} open item{carryCount === 1 ? '' : 's'} carried from your last debrief
              with {LP_EVENT.counterpart.split(' ')[0]}
            </span>
          </div>
        )}

        <div className={styles.heroNext}>
          <ArrowRight size={16} aria-hidden="true" />
          <span>{nextMove}</span>
        </div>
      </button>

      <div className={styles.contrast}>
        <Fold label="Also on your calendar" meta={`${SECONDARY_EVENTS.length} consequential`}>
          <ul className={styles.eventCards}>
            {SECONDARY_EVENTS.map((event) => (
              <li key={event.id}>
                <button
                  className={styles.eventCard}
                  onClick={() => onSelectEvent(event.id)}
                  aria-label={`Open ${event.name} with ${event.counterpart}`}
                  type="button"
                >
                  <div className={styles.heroTop}>
                    <span className={styles.heroTime}>
                      <Clock size={13} aria-hidden="true" />
                      {event.timeUntil}
                    </span>
                    <span className={styles.heroRisk}>
                      <Shield size={12} aria-hidden="true" />
                      {event.risk} risk
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
    </div>
  );
}
