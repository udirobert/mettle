'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Shield, X, Zap } from 'lucide-react';

import styles from './welcome-overlay.module.css';

const WALKTHROUGH_KEY = 'mettle.walkthrough.seen';

const PHASES = [
  {
    label: 'Coach',
    description: 'Stress-test your position with adversarial analysis before the room does.',
  },
  {
    label: 'Rehearse',
    description: 'Role-play the conversation against a skeptical counterpart.',
  },
  {
    label: 'Live',
    description: 'Get real-time tactical support during the actual conversation.',
  },
  {
    label: 'Debrief',
    description: 'Capture commitments and open items before they evaporate.',
  },
];

export function WelcomeOverlay({ onDismiss }: { onDismiss?: () => void }) {
  const [visible, setVisible] = useState(false);
  const [panel, setPanel] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(WALKTHROUGH_KEY);
    if (!seen) setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [visible]);

  const dismiss = () => {
    localStorage.setItem(WALKTHROUGH_KEY, 'true');
    setVisible(false);
    onDismiss?.();
  };

  const next = () => {
    if (panel < 2) setPanel(panel + 1);
    else dismiss();
  };

  if (!visible) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Welcome to Mettle">
      <div className={styles.card}>
        <button
          className={styles.closeBtn}
          onClick={dismiss}
          aria-label="Skip walkthrough"
          type="button"
        >
          <X size={16} />
        </button>

        {panel === 0 && <PanelIntro />}
        {panel === 1 && <PanelFlow />}
        {panel === 2 && <PanelStart />}

        <div className={styles.footer}>
          <div className={styles.dots}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={`${styles.dot} ${i === panel ? styles.dotActive : ''}`} />
            ))}
          </div>
          <button className={styles.nextBtn} onClick={next} type="button">
            {panel === 2 ? 'Get started' : 'Next'}
            {panel < 2 && <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function PanelIntro() {
  return (
    <div className={styles.panel}>
      <div className={styles.badge}>
        <Shield size={14} />
        <span>For the conversations that matter</span>
      </div>
      <h1 className={styles.headline}>
        Prepare for the conversations
        <br />
        you can't afford to get wrong.
      </h1>
      <p className={styles.body}>
        Mettle is a stakes-aware preparation layer. It stress-tests your position, rehearses the
        hard parts, and supports you in the moment.
      </p>
    </div>
  );
}

function PanelFlow() {
  return (
    <div className={styles.panel}>
      <div className={styles.badge}>
        <Zap size={14} />
        <span>How it works</span>
      </div>
      <h1 className={styles.headline}>Four phases. One conversation.</h1>
      <div className={styles.phaseList}>
        {PHASES.map((phase, i) => (
          <div key={phase.label} className={styles.phaseItem}>
            <div className={styles.phaseStep}>
              <span className={styles.phaseNum}>{i + 1}</span>
              <strong className={styles.phaseLabel}>{phase.label}</strong>
            </div>
            <p className={styles.phaseDesc}>{phase.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelStart() {
  return (
    <div className={styles.panel}>
      <div className={styles.badge}>
        <CheckCircle2 size={14} />
        <span>You're ready</span>
      </div>
      <h1 className={styles.headline}>
        Pick your first conversation
        <br />
        to begin.
      </h1>
      <p className={styles.body}>
        Start with your most urgent high-stakes conversation. Mettle will load the pressure points
        and walk you through each phase.
      </p>
      <div className={styles.hint}>
        You can always come back to the event list using the "All events" button.
      </div>
    </div>
  );
}
