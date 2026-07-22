'use client';

import { AlertTriangle, CheckCircle2, Clock, FileText, Shield, User } from 'lucide-react';
import { useConversationState } from '@/hooks/use-conversation-state';
import type { ConversationState } from '@/hooks/use-conversation-state';
import { hasApprovedEvidence } from '@/fixtures/evidence-fixtures';

import styles from './event-list.module.css';

type Scenario = {
  id: string;
  name: string;
  counterpart: string;
  stakes: string;
  risk: 'High' | 'Medium-High' | 'Medium';
  timeUntil: string;
};

const SCENARIOS: Scenario[] = [
  {
    id: 'lp_renewal',
    name: 'LP Renewal',
    counterpart: 'Elena Park',
    stakes: "$40M LP renewal from fund's second-largest investor",
    risk: 'High',
    timeUntil: '2 days',
  },
  {
    id: 'performance_review',
    name: 'Performance Review',
    counterpart: 'Marcus Chen',
    stakes: 'Terminating a senior employee with 8 years tenure',
    risk: 'High',
    timeUntil: '1 week',
  },
  {
    id: 'board_update',
    name: 'Board Update',
    counterpart: 'Victoria Sterling',
    stakes: 'Q3 miss and revised annual guidance',
    risk: 'Medium-High',
    timeUntil: '3 days',
  },
  {
    id: 'salary_negotiation',
    name: 'Salary Negotiation',
    counterpart: 'Sarah Martinez',
    stakes: 'VP promotion compensation package',
    risk: 'Medium',
    timeUntil: '5 days',
  },
];

type PrepProgress = {
  brief: boolean;
  rehearsal: boolean;
  evidence: boolean;
  live: boolean;
};

function getPrepProgress(state: ConversationState, scenarioId: string): PrepProgress {
  if (state.scenario_id !== scenarioId) {
    return {
      brief: false,
      rehearsal: false,
      evidence: false,
      live: false,
    };
  }

  const hasBrief = !!state.coach_analysis;
  const hasRehearsal =
    state.transcript?.some((t) => t.speaker === 'user' || t.speaker === 'counterpart') ?? false;
  const hasLiveSupport = !!state.reactive_reply;

  return {
    brief: hasBrief,
    rehearsal: hasRehearsal,
    evidence: hasApprovedEvidence(scenarioId),
    live: hasLiveSupport,
  };
}

function getPrepStatus(state: ConversationState, scenarioId: string): string {
  const progress = getPrepProgress(state, scenarioId);
  const completed = [progress.brief, progress.rehearsal, progress.live].filter(Boolean).length;

  if (completed === 0) return 'Not started';
  if (completed === 3) return 'Fully prepared';
  return `${completed} of 3 phases complete`;
}

function getRiskColor(risk: string): string {
  if (risk === 'High') return 'var(--tomato)';
  if (risk === 'Medium-High') return 'var(--amber)';
  return 'var(--lime)';
}

export function EventList({ onSelectEvent }: { onSelectEvent: (scenarioId: string) => void }) {
  const { state } = useConversationState();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Your consequential conversations</h1>
        <p className={styles.subtitle}>
          High-stakes conversations deserve preparation, rehearsal, and live support.
        </p>
      </header>

      <div className={styles.grid}>
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.id}
            className={styles.card}
            onClick={() => onSelectEvent(scenario.id)}
            aria-label={`Open ${scenario.name}`}
          >
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>{scenario.name}</h3>
              <div className={styles.cardMeta}>
                <span className={styles.timeUntil}>
                  <Clock size={12} />
                  {scenario.timeUntil}
                </span>
              </div>
            </div>

            <div className={styles.cardBody}>
              <div className={styles.counterpart}>
                <User size={14} />
                <span>{scenario.counterpart}</span>
              </div>

              <div className={styles.stakes}>
                <AlertTriangle size={14} />
                <span>{scenario.stakes}</span>
              </div>

              <div className={styles.statusRow}>
                <div className={styles.statusItem}>
                  <span
                    className={styles.riskBadge}
                    style={{ borderColor: getRiskColor(scenario.risk) }}
                  >
                    <Shield size={12} />
                    <span style={{ color: getRiskColor(scenario.risk) }}>{scenario.risk} risk</span>
                  </span>
                </div>

                <div className={styles.statusItem}>
                  <span className={styles.prepStatus}>{getPrepStatus(state, scenario.id)}</span>
                </div>
              </div>

              <div className={styles.progressRow}>
                <div className={styles.progressItem}>
                  <CheckCircle2
                    size={16}
                    className={
                      getPrepProgress(state, scenario.id).brief
                        ? styles.progressComplete
                        : styles.progressPending
                    }
                  />
                  <span className={styles.progressLabel}>Brief</span>
                </div>
                <div className={styles.progressItem}>
                  <CheckCircle2
                    size={16}
                    className={
                      getPrepProgress(state, scenario.id).rehearsal
                        ? styles.progressComplete
                        : styles.progressPending
                    }
                  />
                  <span className={styles.progressLabel}>Rehearsal</span>
                </div>
                <div className={styles.progressItem}>
                  <CheckCircle2
                    size={16}
                    className={
                      getPrepProgress(state, scenario.id).evidence
                        ? styles.progressComplete
                        : styles.progressPending
                    }
                  />
                  <span className={styles.progressLabel}>Evidence</span>
                </div>
                <div className={styles.progressItem}>
                  <CheckCircle2
                    size={16}
                    className={
                      getPrepProgress(state, scenario.id).live
                        ? styles.progressComplete
                        : styles.progressPending
                    }
                  />
                  <span className={styles.progressLabel}>Live</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
