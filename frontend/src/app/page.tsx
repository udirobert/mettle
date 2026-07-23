'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, BadgeCheck, Radio, ScrollText, Sparkles } from 'lucide-react';
import { CopilotChatConfigurationProvider } from '@copilotkit/react-core/v2';

import { CoachPanel } from '@/components/coach-panel';
import { DebriefView } from '@/components/debrief-view';
import { EventList } from '@/components/event-list';
import { OpponentChat } from '@/components/opponent-chat';
import { WelcomeOverlay } from '@/components/welcome-overlay';
import { WingmanSidePanel } from '@/components/wingman-side-panel';
import { useConversationState, type ConversationState } from '@/hooks/use-conversation-state';

import styles from './page.module.css';

type Phase = 'prep' | 'rehearsal' | 'live' | 'debrief';

const PHASES: Array<{ id: Phase; label: string }> = [
  { id: 'prep', label: 'Coach' },
  { id: 'rehearsal', label: 'Rehearse' },
  { id: 'live', label: 'Live' },
  { id: 'debrief', label: 'Debrief' },
];

function isPhaseUnlocked(phase: Phase, state: ConversationState): boolean {
  switch (phase) {
    case 'prep':
      return true;
    case 'rehearsal':
      return !!state.coach_analysis;
    case 'live':
      return (state.transcript?.length ?? 0) > 0;
    case 'debrief':
      return (state.nudges_sent?.length ?? 0) > 0;
    default:
      return true;
  }
}

function getPhaseHint(phase: Phase, state: ConversationState): string {
  if (isPhaseUnlocked(phase, state)) {
    return `Switch to ${PHASES.find((p) => p.id === phase)?.label}`;
  }
  switch (phase) {
    case 'rehearsal':
      return 'Finish the Coach brief before rehearsing';
    case 'live':
      return 'Run a rehearsal before going live';
    case 'debrief':
      return 'Complete a live conversation before debriefing';
    default:
      return '';
  }
}

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
  const { state, setPhase, runCoach, isAgentRunning } = useConversationState();
  const [localPhase, setLocalPhase] = useState<Phase>(state.phase ?? 'prep');
  const [showEventList, setShowEventList] = useState(!state.scenario_id);

  const selectPhase = (phase: Phase) => {
    setLocalPhase(phase);
    setPhase(phase);
  };

  const handleSelectEvent = async (scenarioId: string) => {
    if (isAgentRunning) return;
    setShowEventList(false);
    setLocalPhase('prep');
    await runCoach(scenarioId);
  };

  const handleBackToEvents = () => {
    setShowEventList(true);
  };

  const counterpart =
    typeof state.counterpart_profile?.name === 'string'
      ? state.counterpart_profile.name
      : 'Counterpart';

  if (showEventList) {
    return (
      <CopilotChatConfigurationProvider agentId="default">
        <main className={styles.shell}>
          <header className={styles.topbar}>
            <div className={styles.wordmark} aria-label="Mettle">
              <span className={styles.wordmarkMark}>M</span>
              <span>Mettle</span>
            </div>
          </header>
          <WelcomeOverlay />
          <EventList onSelectEvent={handleSelectEvent} />
        </main>
      </CopilotChatConfigurationProvider>
    );
  }

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
            <button
              className={styles.backButton}
              onClick={handleBackToEvents}
              aria-label="Back to events"
            >
              <ArrowLeft size={16} />
              <span>All events</span>
            </button>
            <div className={styles.railLabel}>Prep sequence</div>
            <div className={styles.phaseList}>
              {PHASES.map(({ id, label }) => {
                const active = localPhase === id;
                const unlocked = isPhaseUnlocked(id, state);
                const muted = !active && !unlocked;
                return (
                  <button
                    key={id}
                    className={`${styles.phaseButton} ${active ? styles.phaseButtonActive : ''} ${muted ? styles.phaseButtonMuted : ''}`}
                    onClick={() => selectPhase(id)}
                    aria-current={active ? 'step' : undefined}
                    title={active ? `${label} — current phase` : getPhaseHint(id, state)}
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
