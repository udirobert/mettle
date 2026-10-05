import { describe, expect, it } from 'vitest';
import type { ScoutEvent } from '@/hooks/use-conversation-state';
import { counterpartRef } from './counterpart-ref';
import { describeAgentStatus, describeScoutSource } from './scout-status';

const ev = (action: string, detail = 'x'): ScoutEvent => ({
  ts: '2026-10-05T00:00:00Z',
  actor: 'scout',
  action,
  detail,
});

describe('counterpartRef', () => {
  it('matches the backend key', () => {
    expect(counterpartRef(' Dana  Reyes! ')).toBe('dana-reyes');
    expect(counterpartRef('Dana Whitfield')).toBe('dana-whitfield');
    expect(counterpartRef('O\u2019Brien & Co')).toBe('o-brien-co');
    expect(counterpartRef('!!!')).toBe('');
  });
});

describe('describeScoutSource', () => {
  it('never lets fixture activity pass as real work', () => {
    const s = describeScoutSource([ev('read_thread')], { isFixture: true });
    expect(s.kind).toBe('sample');
    expect(s.hint).toMatch(/not from your inbox/i);
  });

  it('says so when there is no activity', () => {
    expect(describeScoutSource(undefined).kind).toBe('none');
    expect(describeScoutSource([]).kind).toBe('none');
  });

  it('flags the bundled sample thread', () => {
    const s = describeScoutSource([ev('read_thread', 'Read your thread with Dana — 3 claims (sample thread)')]);
    expect(s.kind).toBe('degraded');
    expect(s.label).toBe('Sample thread');
  });

  it('flags skipped steps with a count', () => {
    const s = describeScoutSource([ev('read_thread'), ev('skipped'), ev('skipped')]);
    expect(s.kind).toBe('degraded');
    expect(s.hint).toContain('skipped 2 steps');
  });

  it('is live only when nothing was skipped or sampled, and mentions withheld lines', () => {
    expect(describeScoutSource([ev('read_thread'), ev('researched')]).kind).toBe('live');
    expect(describeScoutSource([ev('read_thread'), ev('quarantined')]).hint).toMatch(/withheld/);
  });
});

describe('describeAgentStatus', () => {
  it('treats a missing or degraded response as offline', () => {
    expect(describeAgentStatus(null).kind).toBe('offline');
    expect(describeAgentStatus({ degraded: true }).kind).toBe('offline');
  });
  it('distinguishes an unreachable backend', () => {
    expect(describeAgentStatus({ storage: 'neon', backend: { reachable: false } }).kind).toBe('limited');
  });
  it('reports where state lives when connected', () => {
    expect(describeAgentStatus({ storage: 'neon', backend: { reachable: true } }).label).toContain('Neon');
    expect(describeAgentStatus({ storage: 'local', backend: { reachable: true } }).label).toContain('local');
  });
});
