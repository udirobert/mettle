'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { ArrowLeft, CircleHelp, Lock, LockOpen, Radio } from 'lucide-react';
import { CopilotChatConfigurationProvider } from '@copilotkit/react-core/v2';

import { CoachPanel } from '@/components/coach-panel';
import { EventList } from '@/components/event-list';
import { NudgeCard } from '@/components/nudge-card';
import { replayWalkthrough } from '@/components/welcome-overlay';
import {
  isPhaseUnlocked,
  JourneyTracker,
  UnlockedToast,
  type Phase,
} from '@/components/journey-tracker';
import { useConversationState, type ConversationState } from '@/hooks/use-conversation-state';
import { findEvent } from '@/fixtures/lp-event';
import { PHASE_LABELS } from '@/lib/phase-labels';

import styles from './page.module.css';

function PhaseLoading() {
  return (
    <div
      className={styles.phaseCanvas}
      style={{ alignItems: 'center', display: 'flex', justifyContent: 'center' }}
    >
      <span>Loading…</span>
    </div>
  );
}

const OpponentChat = dynamic(
  () => import('@/components/opponent-chat').then((m) => m.OpponentChat),
  { loading: PhaseLoading },
);
const WingmanSidePanel = dynamic(
  () => import('@/components/wingman-side-panel').then((m) => m.WingmanSidePanel),
  { loading: PhaseLoading },
);
const DebriefView = dynamic(() => import('@/components/debrief-view').then((m) => m.DebriefView), {
  loading: PhaseLoading,
});

const PHASES: Array<{ id: Phase; label: string }> = [
  { id: 'prep', label: PHASE_LABELS.prep },
  { id: 'rehearsal', label: PHASE_LABELS.rehearsal },
  { id: 'live', label: PHASE_LABELS.live },
  { id: 'debrief', label: PHASE_LABELS.debrief },
];

function getPhaseHint(phase: Phase, state: ConversationState): string {
  if (isPhaseUnlocked(phase, state)) {
    return `Switch to ${PHASES.find((p) => p.id === phase)?.label}`;
  }
  switch (phase) {
    case 'rehearsal':
      return 'Finish the brief before sparring';
    case 'live':
      return 'Spar a round before going live';
    case 'debrief':
      return 'Hold a real conversation — live or sparred — before closing it out';
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
  const { state, startReactiveSession } = useConversationState();
  const latestNudge = state.nudges_sent?.at(-1);
  const reactiveReply = state.reactive_reply;
  const counterpart =
    typeof state.counterpart_profile?.name === 'string'
      ? state.counterpart_profile.name
      : 'Counterpart';

  return (
    <aside className={styles.signalStack} aria-label="Conversation signals">
      <div className={styles.signalHeading}>
        <span>Signal desk</span>
        <Radio size={15} aria-hidden="true" />
      </div>

      <section className={`${styles.signalCard} ${styles.signalCardPrimary}`}>
        <span className={styles.cardEyebrow}>{counterpart}</span>
        <strong className={styles.signalStakes}>
          {(state.stakes || 'High-stakes conversation').replace(/\.$/, '')}
        </strong>
        <div className={styles.cardFooter}>
          <span className={styles.pulse} />
          {phase === 'live' ? 'Listening' : 'Idle'}
        </div>
      </section>

      {reactiveReply ? (
        <section className={`${styles.signalCard} ${styles.signalCardRisk}`}>
          <span className={styles.cardEyebrow}>Say this</span>
          <strong>{reactiveReply}</strong>
        </section>
      ) : latestNudge ? (
        <NudgeCard
          nudge={latestNudge}
          variant="signal"
          actionLabel="Reframe"
          onAction={() =>
            void startReactiveSession(
              `The wingman flagged: "${latestNudge.message}". What should I say next?`,
            )
          }
        />
      ) : (
        <section className={`${styles.signalCard} ${styles.signalCardRisk}`}>
          <span className={styles.cardEyebrow}>Watch for</span>
          <strong>The concession trap</strong>
          <p>Do not offer terms before the renewal standard is clear.</p>
        </section>
      )}
    </aside>
  );
}

export default function HomePage() {
  const { state, setPhase, setPartial, openEvent, isAgentRunning, setPrivacyMode } =
    useConversationState();
  const [localPhase, setLocalPhase] = useState<Phase>(state.phase ?? 'prep');
  const [showEventList, setShowEventList] = useState(!state.scenario_id);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    if (state.phase && state.phase !== localPhase) {
      setLocalPhase(state.phase);
    }
  }, [state.phase, localPhase]);

  const selectPhase = (phase: Phase) => {
    setLocalPhase(phase);
    setPhase(phase);
  };

  // Keyboard flow: 1–4 switch (unlocked) phases, ? opens shortcuts, Escape closes.
  useEffect(() => {
    if (showEventList) return;
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === '?') {
        setShowShortcuts((value) => !value);
        return;
      }
      if (event.key === 'Escape') {
        setShowShortcuts(false);
        return;
      }
      const index = ['1', '2', '3', '4'].indexOf(event.key);
      if (index >= 0) {
        const phase = PHASES[index];
        if (phase && isPhaseUnlocked(phase.id, state)) selectPhase(phase.id);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEventList, state]);

  const privacy = state.privacy_mode ?? 'private';

  // Entry-point instrumentation: distinguishes "felt the hook first" users
  // (rehearsal) from standard prep-first entries, so conversion into full prep
  // is measurable once analytics are attached.
  const markEntry = (entry: 'prep' | 'rehearsal') => {
    try {
      localStorage.setItem('mettle.entry', entry);
    } catch {
      /* storage unavailable — skip instrumentation */
    }
  };

  const handleSelectEvent = (scenarioId: string) => {
    if (isAgentRunning) return;
    openEvent(scenarioId);
    setShowEventList(false);
    setLocalPhase('prep');
    markEntry('prep');
  };

  // "Hours, not days" entry: skip the brief and spar now. One atomic state
  // reset seeds a light brief from the scenario's walk-in lines so Spar is
  // unlocked, then jumps straight in.
  const handleQuickSpar = (scenarioId: string) => {
    if (isAgentRunning) return;
    const event = findEvent(scenarioId);
    if (!event) return;
    setPartial({
      scenario_id: event.id,
      phase: 'rehearsal',
      stakes: event.stakes,
      counterpart_profile: event.counterpartProfile,
      user_weak_points: event.userWeakPoints,
      coach_analysis: {
        blind_spots: event.userWeakPoints.slice(0, 1),
        concrete_moves: event.walkIn.ifThen.map((line) => line.response),
        likely_objections: event.walkIn.ifThen.map((line) => line.trigger),
        opening_strategy: event.walkIn.opening,
        if_then: event.walkIn.ifThen,
        perspectives: [],
        disagreements: [],
        consensus: [event.walkIn.avoid],
      },
      coach_stage: 'ready',
      context_brief: undefined,
      transcript: [],
      nudges_sent: [],
      nudge_acknowledgements: [],
      reactive_reply: null,
      debrief_notes: [],
      conversation_source: undefined,
    });
    setShowEventList(false);
    setLocalPhase('rehearsal');
    markEntry('rehearsal');
    localStorage.setItem('mettle.walkthrough.seen', 'true');
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
          <EventList onSelectEvent={handleSelectEvent} onQuickSpar={handleQuickSpar} />
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
            <button
              className={styles.replayBtn}
              onClick={() => setPrivacyMode(privacy === 'private' ? 'shared' : 'private')}
              title={
                privacy === 'private'
                  ? 'Private mode — evidence is redacted in shares'
                  : 'Shared mode — full context allowed in shares'
              }
              type="button"
            >
              {privacy === 'private' ? (
                <Lock size={13} aria-hidden="true" />
              ) : (
                <LockOpen size={13} aria-hidden="true" />
              )}
              <span>{privacy === 'private' ? 'Private' : 'Shared'}</span>
            </button>
            <button
              className={styles.replayBtn}
              onClick={replayWalkthrough}
              title="Replay the walkthrough (?)"
              type="button"
            >
              <CircleHelp size={14} aria-hidden="true" />
              <span>Replay tour</span>
            </button>
          </div>
        </header>

        <div className={`${styles.workspace} ${localPhase === 'live' ? styles.withSignal : ''}`}>
          <nav className={styles.phaseRail} aria-label="This conversation">
            <button
              className={styles.backButton}
              onClick={handleBackToEvents}
              aria-label="Back to event list"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <div className={styles.railLabel}>Now</div>
            <div className={styles.phaseList}>
              {PHASES.filter((phase) => phase.id === 'prep' || phase.id === 'rehearsal').map(
                ({ id, label }) => {
                  const active = localPhase === id;
                  const unlocked = isPhaseUnlocked(id, state);
                  const muted = !active && !unlocked;
                  const isNext = id === 'rehearsal' && unlocked && localPhase === 'prep';
                  return (
                    <button
                      key={id}
                      className={`${styles.phaseButton} ${id === 'prep' ? styles.phaseButtonPrimary : ''} ${active ? styles.phaseButtonActive : ''} ${muted ? styles.phaseButtonMuted : ''} ${isNext ? styles.phaseButtonNext : ''}`}
                      onClick={() => selectPhase(id)}
                      aria-current={active ? 'step' : undefined}
                      title={active ? `${label} — current` : getPhaseHint(id, state)}
                    >
                      <span className={styles.phaseLabel}>{label}</span>
                      {isNext && <span className={styles.nextChip}>Next</span>}
                    </button>
                  );
                },
              )}
            </div>
            <div className={styles.laterLabel}>Later rooms</div>
            <div className={styles.laterList}>
              {PHASES.filter((phase) => phase.id === 'live' || phase.id === 'debrief').map(
                ({ id, label }) => {
                  const active = localPhase === id;
                  const unlocked = isPhaseUnlocked(id, state);
                  const muted = !active && !unlocked;
                  return (
                    <button
                      key={id}
                      className={`${styles.phaseButton} ${styles.phaseButtonLater} ${active ? styles.phaseButtonActive : ''} ${muted ? styles.phaseButtonMuted : ''}`}
                      onClick={() => selectPhase(id)}
                      aria-current={active ? 'step' : undefined}
                      title={active ? `${label} — current` : getPhaseHint(id, state)}
                    >
                      <span className={styles.phaseLabel}>{label}</span>
                      {id === 'live' && active && (
                        <span className={styles.liveDot} aria-label="Live" />
                      )}
                    </button>
                  );
                },
              )}
            </div>
          </nav>

          <section className={styles.canvas}>
            <div className={styles.canvasBar}>
              <h1>{PHASES.find((item) => item.id === localPhase)?.label}</h1>
              <JourneyTracker current={localPhase} />
            </div>
            <div className={`${styles.phaseCanvas} mettle-fade-in`} key={localPhase}>
              <PhaseCanvas phase={localPhase} />
            </div>
          </section>

          {localPhase === 'live' && <SignalStack phase={localPhase} />}
        </div>

        <UnlockedToast />

        {showShortcuts && (
          <div
            className={styles.shortcutsOverlay}
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            onClick={() => setShowShortcuts(false)}
          >
            <div className={styles.shortcutsCard} onClick={(e) => e.stopPropagation()}>
              <p className="mettle-kicker">Keyboard</p>
              <ul className={styles.shortcutsList}>
                <li>
                  <kbd>1</kbd>–<kbd>4</kbd> <span>Jump to {Object.values(PHASE_LABELS).join(' / ')}</span>
                </li>
                <li>
                  <kbd>?</kbd> <span>Show or hide this panel</span>
                </li>
                <li>
                  <kbd>Esc</kbd> <span>Close panels</span>
                </li>
              </ul>
              <button
                className="mettle-action"
                onClick={() => setShowShortcuts(false)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </main>
    </CopilotChatConfigurationProvider>
  );
}
