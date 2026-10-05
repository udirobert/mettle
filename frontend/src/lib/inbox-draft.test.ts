import { describe, expect, it } from 'vitest';
import { draftToState, parseInboxImport, type InboxImportResponse } from './inbox-draft';

const claim = { claim: 'Raise to $185k', source_ids: ['s1'], confidence: 'high' as const, relevance: 'stakes' as const };
const brief = {
  status: 'draft' as const,
  sources: [],
  claims: [claim, { ...claim, claim: 'Promised metrics' }],
  counterpart_history: [],
  open_commitments: [],
  sensitive_redactions: [],
  user_approved_at: null,
};
const live: InboxImportResponse = {
  event: { scenario_id: 'inbox_thread', stakes: 'Raise to $185k', counterpart_profile: { name: 'Dana', role: 'Manager' } },
  brief,
  source: 'agentmail',
  degraded: false,
  agent_inbox_address: 'agent@mettle.test',
};

describe('parseInboxImport', () => {
  it('recognises real mail as live', () => {
    const d = parseInboxImport(live);
    expect(d.kind).toBe('live');
    if (d.kind !== 'empty') {
      expect(d.counterpart).toBe('Dana');
      expect(d.claimCount).toBe(2);
    }
  });

  it('labels the bundled thread as sample, never live', () => {
    expect(parseInboxImport({ ...live, source: 'fixture', degraded: true }).kind).toBe('sample');
    expect(parseInboxImport({ ...live, degraded: true }).kind).toBe('sample');
  });

  it('is empty, with the address, when there is nothing to draft from', () => {
    const d = parseInboxImport({ event: null, brief: null, degraded: true, agent_inbox_address: 'a@b.c', reason: 'no key' });
    expect(d).toEqual({ kind: 'empty', address: 'a@b.c', reason: 'no key' });
    expect(parseInboxImport(null).kind).toBe('empty');
    expect(parseInboxImport({ ...live, brief: { ...brief, claims: [] } }).kind).toBe('empty');
    expect(parseInboxImport({ ...live, event: { ...live.event, counterpart_profile: { name: '  ' } } }).kind).toBe('empty');
  });
});

describe('draftToState', () => {
  it('keeps every claim pending and resets conversation state', () => {
    const d = parseInboxImport(live);
    if (d.kind === 'empty') throw new Error('expected a draft');
    const state = draftToState(d);
    expect(state.scenario_id).toBe('inbox_thread');
    expect(state.phase).toBe('prep');
    expect(state.context_brief?.status).toBe('draft');
    expect(state.context_brief?.claims.every((c) => c.decision === 'pending')).toBe(true);
    expect(state.transcript).toEqual([]);
    expect(state.coach_analysis).toBeUndefined();
    expect(state.agent_inbox_address).toBe('agent@mettle.test');
  });

  it('does not approve claims that were already decided', () => {
    const d = parseInboxImport({ ...live, brief: { ...brief, claims: [{ ...claim, decision: 'rejected' }] } });
    if (d.kind === 'empty') throw new Error('expected a draft');
    expect(draftToState(d).context_brief?.claims[0].decision).toBe('rejected');
  });
});
