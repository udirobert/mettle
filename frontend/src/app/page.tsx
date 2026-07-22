'use client';

import { useState } from 'react';
import { ArrowUpRight, BadgeCheck, Radio, ScrollText, Sparkles } from 'lucide-react';
import { CopilotChatConfigurationProvider } from '@copilotkit/react-core/v2';

import { CoachPanel } from '@/components/coach-panel';
import { DebriefView } from '@/components/debrief-view';
import { OpponentChat } from '@/components/opponent-chat';
import { WingmanSidePanel } from '@/components/wingman-side-panel';
import { useConversationState } from '@/hooks/use-conversation-state';

import styles from './page.module.css';

type Phase = 'prep' | 'rehearsal' | 'live' | 'debrief';

const PHASES: Array<{ id: Phase; label: string }> = [
  { id: 'prep', label: 'Coach' },
  { id: 'rehearsal', label: 'Rehearse' },
  { id: 'live', label: 'Live' },
  { id: 'debrief', label: 'Debrief' },
];

function PhaseCanvas({ phase }: { phase: Phase }) {
  if (phase === 'prep') return <CoachPanel />;
  if (phase === 'rehearsal') return <OpponentChat />;
  if (phase === 'live') return <WingmanSidePanel />;
  return <DebriefView />;
}

function SignalStack({ phase }: { phase: Phase }) {
  const { state } = useConversationState();
  const latestNudge = state.nudges_sent?.at(-1);
  const counterpart =
    typeof state.counterpart_profile?.name === 'string'
      ? state.counterpart_profile.name
      : 'Elena Markova';

  return (
    <aside className={styles.signalStack} aria-label="Conversation signals">
      <div className={styles.signalHeading}>
        <span>Signal desk</span>
        <Radio size={15} aria-hidden="true" />
      </div>

      <section className={`${styles.signalCard} ${styles.signalCardPrimary}`}>
        <span className={styles.cardEyebrow}>The room</span>
        <strong>{counterpart}</strong>
        <p>{state.stakes || '$40M LP renewal, second-largest investor'}</p>
        <div className={styles.cardFooter}>
          <span className={styles.pulse} />
          {phase === 'live' ? 'Listening live' : 'Briefing loaded'}
        </div>
      </section>

      <section className={`${styles.signalCard} ${styles.signalCardRisk}`}>
        <span className={styles.cardEyebrow}>{latestNudge ? 'Latest nudge' : 'Watch for'}</span>
        <strong>{latestNudge ? latestNudge.kind.replace('_', ' ') : 'The concession trap'}</strong>
        <p>
          {latestNudge?.message ||
            'Do not offer terms before you have established the renewal standard.'}
        </p>
      </section>

      <section className={styles.signalCard}>
        <span className={styles.cardEyebrow}>Your edge</span>
        <strong>{state.user_weak_points?.length ?? 0} points surfaced</strong>
        <p>Make the next move specific, short, and tied to evidence.</p>
      </section>

      <button className={styles.briefButton} type="button" title="Open the executive brief">
        <Sparkles size={16} aria-hidden="true" />
        Executive brief
        <ArrowUpRight size={15} aria-hidden="true" />
      </button>
    </aside>
  );
}

function formatScenarioName(id: string | undefined): string {
  if (!id) return 'Consequential conversation';
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function HomePage() {
  const { state, setPhase } = useConversationState();
  const [localPhase, setLocalPhase] = useState<Phase>(state.phase ?? 'prep');

  const selectPhase = (phase: Phase) => {
    setLocalPhase(phase);
    setPhase(phase);
  };

  const counterpart =
    typeof state.counterpart_profile?.name === 'string'
      ? state.counterpart_profile.name
      : 'Counterpart';

  return (
    <CopilotChatConfigurationProvider agentId="default">
      <main className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.wordmark} aria-label="Mettle">
            <span className={styles.wordmarkMark}>M</span>
            <span>Mettle</span>
          </div>
          <div className={styles.meetingName}>
            <span className={styles.statusDot} />
            <span className={styles.counterpartName}>{counterpart}</span>
            {state.stakes && (
              <>
                <span className={styles.meetingDivider}>&middot;</span>
                <span className={styles.meetingStakes}>{state.stakes}</span>
              </>
            )}
          </div>
          <div className={styles.confidential}>
            <BadgeCheck size={16} aria-hidden="true" />
            {formatScenarioName(state.scenario_id)}
          </div>
        </header>

        <div className={`${styles.workspace} ${localPhase === 'live' ? styles.withSignal : ''}`}>
          <nav className={styles.phaseRail} aria-label="Preparation sequence">
            <div className={styles.railLabel}>Prep sequence</div>
            <div className={styles.phaseList}>
              {PHASES.map(({ id, label }) => {
                const active = localPhase === id;
                return (
                  <button
                    key={id}
                    className={`${styles.phaseButton} ${active ? styles.phaseButtonActive : ''}`}
                    onClick={() => selectPhase(id)}
                    aria-current={active ? 'step' : undefined}
                  >
                    <span className={styles.phaseLabel}>{label}</span>
                    {id === 'live' && active && (
                      <span className={styles.liveDot} aria-label="Live" />
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          <section className={styles.canvas}>
            <div className={styles.canvasBar}>
              <h1>{PHASES.find((item) => item.id === localPhase)?.label}</h1>
              {state.stakes && (
                <div className={styles.canvasStakes}>
                  <span className={styles.stakesDot} />
                  {state.stakes}
                </div>
              )}
            </div>
            <div className={styles.phaseCanvas}>
              <PhaseCanvas phase={localPhase} />
            </div>
          </section>

          {localPhase === 'live' && <SignalStack phase={localPhase} />}
        </div>
      </main>
    </CopilotChatConfigurationProvider>
  );
}
