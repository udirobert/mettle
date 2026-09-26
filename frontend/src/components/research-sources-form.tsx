'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Globe } from 'lucide-react';

import type { ContextBrief } from '@/hooks/use-conversation-state';
import { MAX_RESEARCH_URLS, parseUrls } from '@/lib/research';

type ResearchStatus = { available: boolean; max_urls: number };

const fetchStatus = (url: string) => fetch(url).then((r) => r.json() as Promise<ResearchStatus>);

/** Hidden entirely on deployments without a Solari key — no dead options. */
export function useResearchAvailable(): boolean {
  const { data } = useSWR('/api/research/status', fetchStatus, { revalidateOnFocus: false });
  return !!data?.available;
}

export function ResearchSourcesForm({
  counterpart,
  onBrief,
}: {
  counterpart: string;
  onBrief: (brief: ContextBrief) => void;
}) {
  const [text, setText] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urls = parseUrls(text);

  const run = async () => {
    if (!urls.length || running) return;
    setRunning(true);
    setError(null);
    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      const body = (await response.json().catch(() => ({}))) as ContextBrief & {
        error?: string;
        detail?: string;
      };
      if (!response.ok) {
        setError(body.detail || body.error || 'Research failed. Try fewer pages.');
      } else if (!body.claims?.length) {
        setError('The pages loaded, but nothing on them looked decision-relevant.');
      } else {
        onBrief(body);
        setText('');
      }
    } catch {
      setError('Research service unreachable. Paste the thread instead.');
    }
    setRunning(false);
  };

  return (
    <div className="grid gap-2">
      <p className="mettle-copy" style={{ margin: 0 }}>
        Name up to {MAX_RESEARCH_URLS} public pages about {counterpart} or their firm. A recorded
        cloud browser reads them — each claim links to the replay so you can check it.
      </p>
      <textarea
        className="mettle-textarea"
        style={{ minHeight: 88, marginTop: 0 }}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={'https://example.org/annual-report\nhttps://news.example.com/allocation'}
        rows={3}
        aria-label="Public page URLs, one per line"
      />
      {error && (
        <p className="mettle-copy" role="alert" style={{ margin: 0, color: 'var(--tomato)' }}>
          {error}
        </p>
      )}
      <div>
        <button
          className="mettle-action"
          disabled={running || urls.length === 0}
          onClick={() => void run()}
          type="button"
        >
          <Globe size={14} aria-hidden="true" />
          {running
            ? `Reading ${urls.length} page${urls.length === 1 ? '' : 's'}…`
            : urls.length
              ? `Research ${urls.length} page${urls.length === 1 ? '' : 's'}`
              : 'Research pages'}
        </button>
      </div>
    </div>
  );
}
