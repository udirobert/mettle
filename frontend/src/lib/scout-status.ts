import type { ScoutEvent } from '@/hooks/use-conversation-state';

/**
 * Honest labelling for agent activity. The product's claim is "it was already
 * working before you arrived", so anything that is sample data, degraded, or
 * simply absent must say so rather than pass as real work.
 */
export type SourceKind = 'live' | 'degraded' | 'sample' | 'none';

export type SourceDescription = {
  kind: SourceKind;
  label: string;
  /** One plain sentence for a tooltip / screen reader. */
  hint: string;
};

export function describeScoutSource(
  events: ScoutEvent[] | undefined,
  options: { isFixture?: boolean } = {},
): SourceDescription {
  if (options.isFixture) {
    return {
      kind: 'sample',
      label: 'Sample activity',
      hint: 'Illustrative only. This is not from your inbox — connect one to see real work.',
    };
  }
  if (!events || events.length === 0) {
    return { kind: 'none', label: 'No activity yet', hint: 'Scout has not run for this event.' };
  }

  const skipped = events.filter((event) => event.action === 'skipped').length;
  const usedSample = events.some((event) => /\(sample thread\)/i.test(event.detail));
  const quarantined = events.filter((event) => event.action === 'quarantined').length;

  if (usedSample || skipped > 0) {
    const reasons = [
      usedSample ? 'used the sample thread, not your mail' : null,
      skipped > 0 ? `skipped ${skipped} step${skipped === 1 ? '' : 's'}` : null,
    ].filter(Boolean);
    return {
      kind: 'degraded',
      label: usedSample ? 'Sample thread' : 'Partly degraded',
      hint: `Scout ${reasons.join(' and ')}.`,
    };
  }

  return {
    kind: 'live',
    label: 'Live',
    hint: quarantined
      ? `From your inbox and the web. ${quarantined} suspicious line${quarantined === 1 ? ' was' : 's were'} withheld.`
      : 'From your inbox and the web.',
  };
}

/** Shape returned by the Scout's GET /scout/status, via our proxy. */
export type ScoutStatusResponse = {
  degraded?: boolean;
  storage?: 'neon' | 'local';
  models?: string[];
  backend?: { reachable?: boolean };
  summary?: string;
};

export type AgentStatus = {
  kind: 'connected' | 'limited' | 'offline';
  label: string;
  hint: string;
};

export function describeAgentStatus(status: ScoutStatusResponse | null | undefined): AgentStatus {
  if (!status || status.degraded) {
    return {
      kind: 'offline',
      label: 'Scout offline',
      hint: 'The Scout service is not reachable. The app still works with sample data and pasted threads.',
    };
  }
  if (status.backend && status.backend.reachable === false) {
    return {
      kind: 'limited',
      label: 'Scout up, backend down',
      hint: status.summary ?? 'Scout cannot reach the conversation backend, so its steps will be skipped.',
    };
  }
  const where = status.storage === 'neon' ? 'Neon' : 'local storage';
  return {
    kind: 'connected',
    label: `Scout live · ${where}`,
    hint: status.summary ?? 'Scout is connected.',
  };
}
