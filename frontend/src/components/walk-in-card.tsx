'use client';

import { useEffect, useRef } from 'react';
import { Ban, Flame, X } from 'lucide-react';

import type { MettleEvent, WalkIn } from '@/fixtures/lp-event';
import type { CoachAnalysis } from '@/hooks/use-conversation-state';

import styles from './walk-in-card.module.css';

/** Prefer the user's own brief when one exists; otherwise the scenario's defaults. */
function resolveWalkIn(event: MettleEvent, analysis: CoachAnalysis | null): WalkIn {
  if (!analysis) return event.walkIn;
  const lines = (analysis.if_then ?? []).filter((line) => line.trigger && line.response);
  return {
    opening: analysis.opening_strategy || event.walkIn.opening,
    ifThen: lines.length > 0 ? lines.slice(0, 3) : event.walkIn.ifThen,
    avoid: event.walkIn.avoid,
  };
}

export function WalkInCard({
  event,
  analysis,
  onClose,
  onSpar,
}: {
  event: MettleEvent;
  analysis: CoachAnalysis | null;
  onClose: () => void;
  onSpar: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const card = resolveWalkIn(event, analysis);
  const firstName = event.counterpart.split(' ')[0];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="walk-in-title"
      onClose={onClose}
      onClick={(clickEvent) => {
        if (clickEvent.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <div className={styles.card}>
        <header className={styles.head}>
          <div>
            <p className={styles.kicker}>
              Walk-in card · {analysis ? 'from your brief' : 'starter lines'}
            </p>
            <h2 id="walk-in-title" className={styles.title}>
              {event.counterpart}
            </h2>
            <p className={styles.role}>{event.counterpartRole}</p>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={() => dialogRef.current?.close()}
            aria-label="Close walk-in card"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <section className={styles.opening} aria-label="Your opening">
          <p className={styles.label}>Open with</p>
          <p className={styles.openingText}>{card.opening}</p>
        </section>

        <dl className={styles.lines} aria-label={`If ${firstName} pushes back`}>
          {card.ifThen.map((line, index) => (
            <div key={`${line.trigger}-${index}`} className={styles.line}>
              <dt>If {line.trigger.replace(/\.$/, '')}</dt>
              <dd>{line.response}</dd>
            </div>
          ))}
        </dl>

        <p className={styles.avoid}>
          <Ban size={14} aria-hidden="true" />
          <span>
            <strong>Don&apos;t:</strong> {card.avoid.replace(/^(Don't|Do not)\s*/i, '')}
          </span>
        </p>

        <footer className={styles.foot}>
          <button type="button" className={styles.spar} onClick={onSpar}>
            <Flame size={14} aria-hidden="true" /> One quick round with {firstName}
          </button>
          <span className={styles.hint}>Private. Nothing is shared.</span>
        </footer>
      </div>
    </dialog>
  );
}
