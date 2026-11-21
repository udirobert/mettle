import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fanoutCard,
  getGlassesPayload,
  listSinks,
  registerSink,
  removeSink,
  resetGlassesForTests,
  setGlassesIndex,
  setLiveCard,
} from '@/lib/glasses-state';
import type { GlassesNudge } from '@/fixtures/glasses-nudges';

const flush = () => new Promise((r) => setTimeout(r, 0));

const proactive: GlassesNudge = {
  kind: 'proactive',
  headline: 'Anchor at $185k — she budgeted $160k.',
  ttl_ms: 8000,
};

const phase: GlassesNudge = { kind: 'phase', headline: 'LIVE', ttl_ms: 3000 };

describe('glasses relay state', () => {
  beforeEach(() => {
    resetGlassesForTests();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('serves the canned sequence by default and clamps the index', () => {
    expect(getGlassesPayload()).toMatchObject({ mode: 'canned', index: 0, total: 11 });
    setGlassesIndex(99);
    expect(getGlassesPayload().index).toBe(10);
    setGlassesIndex(-4);
    expect(getGlassesPayload().index).toBe(0);
  });

  it('a live card wins; a canned command takes the director back', () => {
    setLiveCard(proactive);
    expect(getGlassesPayload()).toMatchObject({ mode: 'live', card: proactive });
    setGlassesIndex(3);
    expect(getGlassesPayload().mode).toBe('canned');
  });

  it('an expired live card reverts to canned — latest-card, not replay', () => {
    setLiveCard(proactive);
    vi.advanceTimersByTime(8001);
    expect(getGlassesPayload().mode).toBe('canned');
  });

  it('a fresh live card inside its TTL stays live', () => {
    setLiveCard(proactive);
    vi.advanceTimersByTime(7999);
    expect(getGlassesPayload().mode).toBe('live');
  });
});

describe('push-sink registry', () => {
  beforeEach(() => {
    resetGlassesForTests();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers, lists without internals, and removes', () => {
    registerSink({ url: 'http://a/card', id: 'a', kinds: ['proactive'] });
    const sinks = listSinks();
    expect(sinks).toHaveLength(1);
    expect(sinks[0]).toMatchObject({ id: 'a', url: 'http://a/card', kinds: ['proactive'] });
    expect(sinks[0]).not.toHaveProperty('failures');
    expect(removeSink('a')).toBe(true);
    expect(listSinks()).toHaveLength(0);
    expect(removeSink('a')).toBe(false);
  });

  it('fans the card out to registered sinks', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    registerSink({ url: 'http://a/card' });
    fanoutCard(proactive);
    await flush();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://a/card',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ card: proactive }) }),
    );
  });

  it('kind-filters what a sink receives', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    registerSink({ url: 'http://a/card', kinds: ['proactive'] });
    fanoutCard(phase);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redacts to a hint on non-private displays', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    registerSink({ url: 'http://a/card', capabilities: { private_display: false } });
    fanoutCard({ ...proactive, headline: 'SECRET: walk at $170k' });
    await flush();
    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.card.headline).toBe('Mettle — nudge');
    expect(sent.card.headline).not.toContain('SECRET');
  });

  it('evicts a sink after five consecutive failures', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('down'));
    vi.stubGlobal('fetch', fetchMock);
    registerSink({ url: 'http://dead/card', id: 'dead' });
    for (let i = 0; i < 5; i++) {
      fanoutCard(proactive);
      await flush();
    }
    expect(listSinks()).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('a success resets the failure count', async () => {
    let ok = false;
    const fetchMock = vi.fn().mockImplementation(() =>
      ok ? Promise.resolve({ ok: true }) : Promise.reject(new Error('flaky')),
    );
    vi.stubGlobal('fetch', fetchMock);
    registerSink({ url: 'http://flaky/card', id: 'flaky' });
    for (let i = 0; i < 4; i++) {
      fanoutCard(proactive);
      await flush();
    }
    ok = true;
    fanoutCard(proactive);
    await flush();
    ok = false;
    for (let i = 0; i < 4; i++) {
      fanoutCard(proactive);
      await flush();
    }
    // 4 fails + 1 success + 4 fails = 9 calls, still registered (count reset mid-way)
    expect(fetchMock).toHaveBeenCalledTimes(9);
    expect(listSinks()).toHaveLength(1);
  });

  it('one dead sink cannot starve the others', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string) =>
        url.includes('dead') ? Promise.reject(new Error('down')) : Promise.resolve({ ok: true }),
      );
    vi.stubGlobal('fetch', fetchMock);
    registerSink({ url: 'http://dead/card', id: 'dead' });
    registerSink({ url: 'http://alive/card', id: 'alive' });
    for (let i = 0; i < 6; i++) {
      fanoutCard(proactive);
      await flush();
    }
    expect(listSinks().map((s) => s.id)).toEqual(['alive']);
    expect(fetchMock.mock.calls.filter(([u]) => u === 'http://alive/card')).toHaveLength(6);
  });
});
