import type { ConversationState } from '@/hooks/use-conversation-state';

/**
 * Redacted debug report for a stuck or degraded run.
 *
 * Deliberately excludes anything private: no transcript text, no claim text,
 * no message bodies. Source URLs contribute hostnames only — queries can carry
 * tokens — and the report names error classes rather than raw messages.
 */
function hostOnly(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '(unparseable source)';
  }
}

export function buildDebugReport(
  state: ConversationState,
  opts?: { errorClass?: string },
): string {
  const brief = state.context_brief;
  const claims = brief?.claims ?? [];
  const byDecision = {
    pending: claims.filter((c) => !c.decision || c.decision === 'pending').length,
    approved: claims.filter((c) => c.decision === 'approved').length,
    rejected: claims.filter((c) => c.decision === 'rejected').length,
  };
  const lastScoutEvent = state.scout_log?.at(-1);
  const scoutSources = (state.scout_log ?? [])
    .flatMap((event) => event.sources ?? [])
    .map(hostOnly);

  const lines = [
    '# Mettle debug report',
    `generated: ${new Date().toISOString()}`,
    `phase: ${state.phase ?? 'unknown'}`,
    `scenario: ${state.scenario_id ?? 'none'}`,
    `coach_stage: ${state.coach_stage ?? 'idle'}`,
    `privacy_mode: ${state.privacy_mode ?? 'private'}`,
    `conversation_source: ${state.conversation_source ?? 'none'}`,
    `transcript_turns: ${(state.transcript ?? []).length}`,
    `nudges_sent: ${(state.nudges_sent ?? []).length}`,
    `brief_status: ${brief?.status ?? 'none'}`,
    `claims: ${byDecision.approved} approved / ${byDecision.pending} pending / ${byDecision.rejected} rejected`,
    `counterpart_memory: ${state.counterpart_history_ref ? 'linked' : 'none'}`,
    `scout_events: ${(state.scout_log ?? []).length}`,
  ];
  if (lastScoutEvent) {
    lines.push(`last_scout_event: ${lastScoutEvent.action} — ${lastScoutEvent.detail}`);
  }
  if (scoutSources.length) {
    lines.push(`scout_source_hosts: ${[...new Set(scoutSources)].join(', ')}`);
  }
  if (opts?.errorClass) {
    lines.push(`error_class: ${opts.errorClass}`);
  }
  return lines.join('\n');
}
