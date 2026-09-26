'use client';

import { useSyncExternalStore, type CSSProperties } from 'react';
import { ArrowRight, CalendarClock, Flame, IdCard } from 'lucide-react';

import { LP_EVENT } from '@/fixtures/lp-event';

import styles from './first-run.module.css';

const SEEN_KEY = 'mettle.intro.seen';
const listeners = new Set<() => void>();

function readSeen(): 'seen' | 'new' {
  try {
    return window.localStorage.getItem(SEEN_KEY) ? 'seen' : 'new';
  } catch {
    return 'seen';
  }
}

function writeSeen(seen: boolean) {
  try {
    if (seen) window.localStorage.setItem(SEEN_KEY, 'true');
    else window.localStorage.removeItem(SEEN_KEY);
  } catch {
    /* storage unavailable: intro simply shows again next visit */
  }
  listeners.forEach((listener) => listener());
}

/** 'unknown' during SSR so neither the intro nor home flashes before we know. */
export function useIntro() {
  const status = useSyncExternalStore<'seen' | 'new' | 'unknown'>(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readSeen,
    () => 'unknown',
  );
  return {
    status,
    dismiss: () => writeSeen(true),
    reopen: () => writeSeen(false),
  };
}

const MODES = [
  { icon: IdCard, when: 'Minutes out', name: 'Card', what: 'Your lines on one screen.' },
  { icon: Flame, when: 'Hours out', name: 'Rehearse', what: 'They push back. You practise.' },
  { icon: CalendarClock, when: 'Days out', name: 'Prep', what: 'A full brief from your threads.' },
];

function order(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}

export function FirstRun({ onTry, onSkip }: { onTry: () => void; onSkip: () => void }) {
  const sample = LP_EVENT.walkIn.ifThen[0];
  const firstName = LP_EVENT.counterpart.split(' ')[0];

  return (
    <div className={styles.wrap}>
      <section className={styles.promise} aria-labelledby="intro-title">
        <p className={`${styles.kicker} ${styles.step}`} style={order(0)}>
          For fund managers
        </p>
        <h1 id="intro-title" className={`${styles.title} ${styles.step}`} style={order(1)}>
          Rehearse your hardest conversation before it happens.
        </h1>
        <p className={`${styles.sub} ${styles.step}`} style={order(2)}>
          Mettle plays the other side, finds your weak spot, and hands you the line to say.
        </p>
      </section>

      {sample && (
        <figure className={styles.sample} aria-label="Example of what Mettle gives you">
          <div className={styles.sampleCard}>
            <p className={styles.sampleLabel}>{firstName} will ask</p>
            <p className={styles.sampleThey}>&ldquo;Why will liquidity be different this time?&rdquo;</p>
            <div className={styles.sampleRule} aria-hidden="true" />
            <p className={styles.sampleLabel}>You say</p>
            <p className={styles.sampleYou}>{sample.response}</p>
          </div>
          <figcaption className={styles.caption}>What you walk in with</figcaption>
        </figure>
      )}

      <section className={`${styles.scene} ${styles.step}`} style={order(5)} aria-labelledby="scene-title">
        <p id="scene-title" className={styles.sceneTag}>
          Try it
        </p>
        <p className={styles.sceneText}>
          You&apos;re raising a fund. <strong>{LP_EVENT.counterpart}</strong>, one of your investors,
          decides in {LP_EVENT.timeUntil} whether to put in $40M again.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onTry}>
            Rehearse with {firstName} <span className={styles.duration}>60 sec</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
          <button type="button" className={styles.secondary} onClick={onSkip}>
            Look around first
          </button>
        </div>
      </section>

      <ul className={styles.modes} aria-label="Use it based on how long until the meeting">
        {MODES.map(({ icon: Icon, when, name, what }, index) => (
          <li key={name} className={styles.step} style={order(6 + index)}>
            <Icon size={16} aria-hidden="true" />
            <span className={styles.modeWhen}>{when}</span>
            <strong>{name}</strong>
            <span className={styles.modeWhat}>{what}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
