'use client';

import { useScoutStatus } from '@/hooks/use-scout-status';
import { describeAgentStatus, type AgentStatus, type SourceDescription } from '@/lib/scout-status';

import styles from './source-chip.module.css';

/** A small honest label: where this activity actually came from. */
export function SourceChip({
  source,
}: {
  source: Pick<SourceDescription, 'kind' | 'label' | 'hint'>;
}) {
  return (
    <span className={`${styles.chip} ${styles[source.kind]}`} title={source.hint}>
      <span className={styles.dot} aria-hidden="true" />
      {source.label}
      <span className="sr-only"> — {source.hint}</span>
    </span>
  );
}

function StatusChip({ status, busy = false }: { status: AgentStatus; busy?: boolean }) {
  return (
    <span className={`${styles.chip} ${styles[status.kind]}`} title={status.hint}>
      <span className={`${styles.dot} ${busy ? styles.pulse : ''}`} aria-hidden="true" />
      {status.label}
      <span className="sr-only"> — {status.hint}</span>
    </span>
  );
}

/**
 * Whether the agent behind the app is actually connected. The docket's claims
 * ("it was already working") are only as credible as this is honest.
 */
export function AgentStatusChip() {
  const { status, loading } = useScoutStatus();
  if (loading && !status) {
    return (
      <StatusChip
        busy
        status={{
          kind: 'limited',
          label: 'Checking agent…',
          hint: 'Checking whether the Scout is reachable.',
        }}
      />
    );
  }
  return (
    <span role="status" aria-live="polite">
      <StatusChip status={describeAgentStatus(status)} />
    </span>
  );
}
