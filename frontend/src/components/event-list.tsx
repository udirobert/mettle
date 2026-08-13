'use client';

import { useState } from 'react';
import { ArrowRight, Clock, Shield, User } from 'lucide-react';

import { CONTRAST_EVENTS, LP_EVENT } from '@/fixtures/lp-event';
import { useConversationState } from '@/hooks/use-conversation-state';

import styles from './event-list.module.css';

export function EventList({ onSelectEvent }: { onSelectEvent: (scenarioId: string) => void }) {
  const { state } = useConversationState();
  const [showContrast, setShowContrast] = useState(false);

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

        <div className={styles.heroNext}>
          <ArrowRight size={16} aria-hidden="true" />
          <span>{nextMove}</span>
        </div>
      </button>

      <div className={styles.contrast}>
        <button
          className={styles.contrastToggle}
          onClick={() => setShowContrast((value) => !value)}
          type="button"
          aria-expanded={showContrast}
        >
          {showContrast ? 'Hide' : 'Show'} other calendar noise
        </button>
        {showContrast && (
          <ul className={styles.contrastList}>
            {CONTRAST_EVENTS.map((event) => (
              <li key={event.id} className={styles.contrastItem}>
                <span className={styles.contrastName}>{event.name}</span>
                <span className={styles.contrastDetail}>
                  {event.counterpart} · {event.stakes}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
