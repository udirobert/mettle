'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { ArrowRight, Ban, Flame, X } from 'lucide-react';

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

function step(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}

export function WalkInCard({
  event,
  analysis,
  onClose,
  onSpar,
  onPrep,
}: {
  event: MettleEvent;
  analysis: CoachAnalysis | null;
  onClose: () => void;
  onSpar: () => void;
  onPrep: () => void;
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
              {event.kind} · {event.timeUntil}
            </p>
            <h2 id="walk-in-title" className={styles.title}>
              {event.counterpart}
            </h2>
            <p className={styles.role}>{event.stakes}</p>
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

        <section className={`${styles.opening} ${styles.step}`} style={step(0)} aria-label="Your opening">
          <p className={styles.label}>Open</p>
          <p className={styles.openingText}>{card.opening}</p>
        </section>

        <dl className={styles.lines} aria-label={`If ${firstName} pushes back`}>
          {card.ifThen.map((line, index) => (
            <div key={`${line.trigger}-${index}`} className={`${styles.line} ${styles.step}`} style={step(index + 1)}>
              <dt>If {line.trigger.replace(/\.$/, '')}</dt>
              <dd>{line.response}</dd>
            </div>
          ))}
        </dl>

        <p className={`${styles.avoid} ${styles.step}`} style={step(card.ifThen.length + 1)}>
          <Ban size={14} aria-hidden="true" />
          <span>
            <span className="sr-only">{"Don't: "}</span>
            {card.avoid.replace(/^(Don't|Do not)\s*/i, '')}
          </span>
        </p>

        <footer className={styles.foot}>
          <button type="button" className={styles.spar} onClick={onSpar}>
            <Flame size={14} aria-hidden="true" /> Spar
          </button>
          <button type="button" className={styles.prep} onClick={onPrep}>
            Full prep <ArrowRight size={14} aria-hidden="true" />
          </button>
          <span className={styles.hint}>{analysis ? 'From your brief' : 'Starter lines'}</span>
        </footer>
      </div>
    </dialog>
  );
}
