'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SALARY_REVIEW_GLASSES_SEQUENCE } from '@/fixtures/glasses-nudges';
import styles from './glasses.module.css';

/**
 * Rung 2 of the Worn × M6 fallback ladder (docs/WORN_M6.md): a phone/web
 * page that renders whisper-tier payloads exactly as they should read on a
 * mono-green waveguide — one card at a time, nothing else in the field.
 *
 * Controls (for the scripted demo):
 *   space / →  next card        ←  previous card
 *   a          toggle auto-advance (honours each card's ttl_ms)
 *   r          restart          f  fullscreen
 *   ?i=N       pin to card N    ?auto=0  start paused
 *
 * This page is the relay director: every index change is POSTed to
 * /api/glasses, so any bridge polling that endpoint follows the same card
 * the operator is on. Open it on one device only.
 */
function GlassesPreview() {
  const params = useSearchParams();
  const pinned = params.get('i');
  const [index, setIndex] = useState(() => {
    const n = pinned === null ? 0 : Number.parseInt(pinned, 10);
    return Number.isFinite(n)
      ? Math.min(Math.max(n, 0), SALARY_REVIEW_GLASSES_SEQUENCE.length - 1)
      : 0;
  });
  const [auto, setAuto] = useState(pinned === null && params.get('auto') !== '0');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const card = SALARY_REVIEW_GLASSES_SEQUENCE[index];
  const total = SALARY_REVIEW_GLASSES_SEQUENCE.length;

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(Math.max(i + delta, 0), total - 1)),
    [total],
  );

  useEffect(() => {
    if (!auto) return;
    timerRef.current = setTimeout(() => {
      setIndex((i) => (i + 1 < total ? i + 1 : i));
    }, card.ttl_ms);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [auto, index, card.ttl_ms, total]);

  useEffect(() => {
    if (index === total - 1) setAuto(false);
  }, [index, total]);

  // Director → relay: whichever bridge is attached follows this card.
  useEffect(() => {
    fetch('/api/glasses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index }),
    }).catch(() => {});
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft') {
        go(-1);
      } else if (e.key === 'a') {
        setAuto((v) => !v);
      } else if (e.key === 'r') {
        setIndex(0);
        setAuto(true);
      } else if (e.key === 'f') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  return (
    <main className={styles.root} onClick={() => go(1)}>
      <div className={styles.hud} key={index}>
        {card.kind === 'phase' ? (
          <div className={styles.phase}>{card.headline}</div>
        ) : (
          <div className={styles.card}>
            <div className={styles.headline}>{card.headline}</div>
            {card.body && <div className={styles.body}>{card.body}</div>}
          </div>
        )}
      </div>

      <footer className={styles.operator}>
        <span>
          {index + 1}/{total} · {card.kind} · {auto ? 'auto' : 'manual'}
        </span>
        {card.cue && <span className={styles.cue}>{card.cue}</span>}
      </footer>
    </main>
  );
}

export default function GlassesPage() {
  return (
    <Suspense>
      <GlassesPreview />
    </Suspense>
  );
}
