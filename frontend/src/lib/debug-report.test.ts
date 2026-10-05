import { describe, expect, it } from 'vitest';

import { buildDebugReport } from './debug-report';
import type { ConversationState } from '@/hooks/use-conversation-state';

const state: ConversationState = {
  scenario_id: 'salary_review',
  stakes: 'secret stakes text that must not leak',
  counterpart_profile: { name: 'Dana Whitfield' },
  user_weak_points: [],
  transcript: [
    { speaker: 'user', text: 'PRIVATE turn text', timestamp: '2026-10-05T00:00:00Z' },
  ],
  nudges_sent: [],
  open_reactive_query: null,
  phase: 'prep',
  scout_log: [
    {
      ts: '2026-10-05T00:00:00Z',
      actor: 'scout',
      action: 'researched',
      detail: 'Found public sources',
      sources: ['https://example.com/report?token=secret&session=abc'],
    },
  ],
  context_brief: {
    status: 'draft',
    sources: [],
    claims: [
      {
        claim: 'PRIVATE claim text',
        source_ids: [],
        confidence: 'high',
        relevance: 'commitment',
        decision: 'pending',
      },
    ],
    counterpart_history: [],
    open_commitments: [],
    sensitive_redactions: [],
    user_approved_at: null,
  },
};

describe('buildDebugReport', () => {
  it('includes run state and counts', () => {
    const report = buildDebugReport(state);
    expect(report).toContain('phase: prep');
    expect(report).toContain('transcript_turns: 1');
    expect(report).toContain('claims: 0 approved / 1 pending / 0 rejected');
    expect(report).toContain('scout_events: 1');
  });

  it('never includes message bodies, claim text, or URL queries', () => {
    const report = buildDebugReport(state, { errorClass: 'timeout' });
    expect(report).not.toContain('PRIVATE');
    expect(report).not.toContain('secret stakes');
    expect(report).not.toContain('token=');
    expect(report).not.toContain('session=');
    expect(report).toContain('example.com');
    expect(report).toContain('error_class: timeout');
  });
});
