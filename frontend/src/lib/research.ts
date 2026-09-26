import type { ContextBrief, ContextSource } from '@/hooks/use-conversation-state';

export const MAX_RESEARCH_URLS = 5;

export function parseUrls(text: string): string[] {
  const urls: string[] = [];
  for (const raw of text.split(/[\s,]+/)) {
    const candidate = raw.trim();
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if ((url.protocol === 'http:' || url.protocol === 'https:') && !urls.includes(url.href)) {
        urls.push(url.href);
      }
    } catch {
      /* not a URL — ignore */
    }
  }
  return urls.slice(0, MAX_RESEARCH_URLS);
}

/** Append a research brief onto an existing draft, renumbering source ids so runs never collide. */
export function mergeBriefs(base: ContextBrief | undefined, extra: ContextBrief): ContextBrief {
  if (!base || !base.claims?.length) return { ...extra, status: 'draft', user_approved_at: null };

  const taken = new Set(base.sources.map((source) => source.source_id));
  const remap = new Map<string, string>();
  let next = base.sources.length + 1;
  for (const source of extra.sources) {
    let id = source.source_id;
    while (taken.has(id)) id = `solari-${next++}`;
    taken.add(id);
    remap.set(source.source_id, id);
  }

  return {
    ...base,
    status: 'draft',
    user_approved_at: null,
    sources: [
      ...base.sources,
      ...extra.sources.map((source) => ({ ...source, source_id: remap.get(source.source_id)! })),
    ],
    claims: [
      ...base.claims,
      ...extra.claims.map((claim) => ({
        ...claim,
        source_ids: claim.source_ids.map((id) => remap.get(id) ?? id),
      })),
    ],
  };
}

export function findSource(brief: ContextBrief, sourceIds: string[]): ContextSource | undefined {
  return brief.sources?.find((source) => sourceIds.includes(source.source_id));
}

export function replayHref(source: ContextSource): string | null {
  if (!source.replay_session_id) return null;
  const params = new URLSearchParams();
  if (source.url) params.set('url', source.url);
  if (source.title) params.set('title', source.title);
  const query = params.toString();
  return `/replay/${encodeURIComponent(source.replay_session_id)}${query ? `?${query}` : ''}`;
}
