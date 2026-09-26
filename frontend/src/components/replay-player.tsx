'use client';

import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import { RefreshCw } from 'lucide-react';

import { replayDataUrl } from '@/lib/research';

type ReplayEvent = { type: number; timestamp: number; data: unknown };

async function fetchReplay(url: string): Promise<ReplayEvent[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status));
  const text = await response.text();
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as ReplayEvent);
}

/** Plays back the rrweb DOM recording of a Solari research session. */
export function ReplayPlayer({ sessionId, height = 420 }: { sessionId: string; height?: number }) {
  const {
    data: events,
    error,
    isLoading,
    mutate,
  } = useSWR(replayDataUrl(sessionId), fetchReplay, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = mountRef.current;
    if (!target || !events || events.length < 2) return;
    let player: { $destroy?: () => void } | null = null;
    let cancelled = false;

    void import('rrweb-player').then(({ default: Player }) => {
      if (cancelled) return;
      target.innerHTML = '';
      // Svelte 4 component instance: $destroy exists at runtime but isn't in the d.ts.
      player = new Player({
        target,
        props: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          events: events as any,
          width: Math.min(target.clientWidth || 720, 960),
          height,
          autoPlay: true,
          skipInactive: true,
        },
      }) as unknown as { $destroy?: () => void };
    });

    return () => {
      cancelled = true;
      player?.$destroy?.();
    };
  }, [events, height]);

  if (isLoading) {
    return (
      <p className="mettle-label" role="status" style={{ marginTop: 20 }}>
        Fetching the recording…
      </p>
    );
  }

  if (error || !events || events.length < 2) {
    return (
      <div className="mettle-card mettle-card--risk" role="alert" style={{ marginTop: 20 }}>
        <strong>The replay isn&apos;t available yet.</strong>
        <p>Recordings upload shortly after a run. If this persists, the session may have expired.</p>
        <button
          className="mettle-icon-action"
          onClick={() => void mutate()}
          type="button"
          style={{ marginTop: 10 }}
        >
          <RefreshCw size={13} aria-hidden="true" /> Try again
        </button>
      </div>
    );
  }

  return <div ref={mountRef} style={{ overflow: 'hidden' }} aria-label="Session replay" />;
}
