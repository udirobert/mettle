'use client';

import { useState } from 'react';
import { ArrowRight, Clock, Repeat, Shield, User, Zap } from 'lucide-react';

import { LP_EVENT, SECONDARY_EVENTS } from '@/fixtures/lp-event';
import { SALARY_EVENT, SALARY_SCOUT_LOG } from '@/fixtures/salary-event';
import { useConversationState } from '@/hooks/use-conversation-state';
import { ScoutLog } from '@/components/scout-log';
import { CounterpartDossier } from '@/components/dossier';

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
  const [carryCount] = useState(() => readCarryCount(SALARY_EVENT.counterpart));

  const isDana = state.scenario_id === SALARY_EVENT.id;
  const hasBrief = isDana && !!state.coach_analysis;
  const hasEvidence =
    isDana &&
    state.context_brief?.status === 'approved' &&
    (state.context_brief.claims?.length ?? 0) > 0;

  // Real Scout events once the backend emits them; the seed log stands in for
  // them so the "it was already working" beat survives when the scout is stubbed.
  const scoutEvents = isDana ? (state.scout_log ?? SALARY_SCOUT_LOG) : [];

  const nextMove = !hasEvidence
    ? 'Forward the thread to Mettle, then run Coach.'
    : !hasBrief
      ? 'Evidence is approved. Run Coach.'
      : 'Open Coach — then rehearse with Dana.';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <p className={styles.kicker}>Your docket</p>
        <h1 className={styles.title}>The conversations that matter.</h1>
        <p className={styles.subtitle}>
          Not every meeting. {SALARY_EVENT.stakes.replace(/\.$/, '')} — and it lands Thursday.
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
        onClick={() => onSelectEvent(SALARY_EVENT.id)}
        aria-label={`Open ${SALARY_EVENT.name} with ${SALARY_EVENT.counterpart}`}
        type="button"
      >
        <div className={styles.heroTop}>
          <span className={styles.heroTime}>
            <Clock size={14} aria-hidden="true" />
            {SALARY_EVENT.timeUntil}
          </span>
          <span className={styles.heroRisk}>
            <Shield size={13} aria-hidden="true" />
            {SALARY_EVENT.risk} risk
          </span>
        </div>

        <p className={styles.heroStakes}>{SALARY_EVENT.stakes.replace(/\.$/, '')}</p>
        <div className={styles.heroWho}>
          <h2 className={styles.heroName}>{SALARY_EVENT.counterpart}</h2>
          <p className={styles.heroRole}>{SALARY_EVENT.counterpartRole}</p>
        </div>

        <div className={styles.heroMeta}>
          <span className={styles.heroCounterpart}>
            <User size={14} aria-hidden="true" />
            {SALARY_EVENT.name}
          </span>
          <span className={hasBrief ? styles.prepReady : styles.prepIncomplete}>
            {hasBrief ? 'Brief ready' : 'Prep incomplete'}
          </span>
        </div>

        {carryCount > 0 && (
          <div className={styles.carryBadge} aria-label="Open items from your last conversation">
            <Repeat size={13} aria-hidden="true" />
            <span>
              {carryCount} open item{carryCount === 1 ? '' : 's'} carried from your last debrief
              with {SALARY_EVENT.counterpart.split(' ')[0]}
            </span>
          </div>
        )}

        <div className={styles.heroNext}>
          <ArrowRight size={16} aria-hidden="true" />
          <span>{nextMove}</span>
        </div>
      </button>

      {/* The briefing must not depend on the Scout log existing — the
          degraded inbox path renders no scout events, and the counterpart
          dossier is exactly what you want most in that case. */}
      {scoutEvents.length > 0 && (
        <div className={styles.scoutWrap}>
          <ScoutLog events={scoutEvents} title="Scout" />
        </div>
      )}

      <div className={styles.scoutWrap}>
        <CounterpartDossier profile={SALARY_EVENT.counterpartProfile} />
      </div>

      <div className={styles.contrast}>
        <p className={styles.kicker}>Everything else on the calendar</p>
        <ul className={styles.eventCards}>
          <li>
            <button
              className={styles.eventCard}
              onClick={() => onSelectEvent(LP_EVENT.id)}
              aria-label={`Open ${LP_EVENT.name} with ${LP_EVENT.counterpart}`}
              type="button"
            >
              <div className={styles.heroTop}>
                <span className={styles.heroTime}>
                  <Clock size={13} aria-hidden="true" />
                  {LP_EVENT.timeUntil}
                </span>
                <span className={styles.heroRisk}>
                  <Shield size={12} aria-hidden="true" />
                  {LP_EVENT.risk} risk
                </span>
              </div>
              <span className={styles.eventCardName}>{LP_EVENT.name}</span>
              <span className={styles.contrastDetail}>
                {LP_EVENT.counterpart} · {LP_EVENT.stakes}
              </span>
              <span className={styles.eventCardCta}>
                <ArrowRight size={13} aria-hidden="true" /> Prep this
              </span>
            </button>
          </li>
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
      </div>
    </div>
  );
}
