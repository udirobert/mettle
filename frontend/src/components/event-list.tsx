'use client';

import { AlertTriangle, CheckCircle2, Clock, FileText, Shield, User } from 'lucide-react';
import { useConversationState } from '@/hooks/use-conversation-state';
import type { ConversationState } from '@/hooks/use-conversation-state';

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

function getPrepStatus(state: ConversationState, scenarioId: string): string {
  // Only show actual status for the currently selected scenario
  if (state.scenario_id !== scenarioId) {
    return 'Not started';
  }

  const hasCoach = !!state.coach_analysis;
  const hasRehearsal = state.transcript.length > 0 && state.phase !== 'prep';
  const hasLive = state.transcript.length > 0 && state.phase === 'live';

  if (hasLive) return 'Live support active';
  if (hasRehearsal) return 'Rehearsal complete';
  if (hasCoach) return 'Brief prepared';
  return 'In progress';
}

function getPrepStatusIcon(state: ConversationState, scenarioId: string) {
  if (state.scenario_id !== scenarioId) {
    return <Clock size={14} />;
  }

  const hasCoach = !!state.coach_analysis;
  const hasRehearsal = state.transcript.length > 0 && state.phase !== 'prep';
  const hasLive = state.transcript.length > 0 && state.phase === 'live';

  if (hasLive) return <CheckCircle2 size={14} />;
  if (hasRehearsal) return <CheckCircle2 size={14} />;
  if (hasCoach) return <FileText size={14} />;
  return <Clock size={14} />;
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
                  {getPrepStatusIcon(state, scenario.id)}
                  <span className={styles.prepStatus}>{getPrepStatus(state, scenario.id)}</span>
                </div>

                <div className={styles.statusItem}>
                  <FileText size={14} />
                  <span className={styles.evidenceStatus}>No evidence imported</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
