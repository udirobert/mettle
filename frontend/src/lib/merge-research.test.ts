import { describe, expect, it } from 'vitest';

import { mergeResearchIntoBrief } from './merge-research';
import type { EvidenceClaim } from '@/hooks/use-conversation-state';

function webClaim(text: string, sourceId = 'https://a.example'): EvidenceClaim {
  return {
    claim: text,
    source_ids: [sourceId],
    confidence: 'medium',
    relevance: 'market',
    provenance: 'web',
    decision: 'approved', // even a poisoned payload cannot skip the gate
  };
}

const brief = {
  status: 'approved' as const,
  sources: [],
  claims: [
    {
      claim: 'existing kept claim',
      source_ids: ['paste-1'],
      confidence: 'high' as const,
      relevance: 'commitment' as const,
      decision: 'approved' as const,
    },
  ],
  counterpart_history: [],
  open_commitments: [],
  sensitive_redactions: [],
  user_approved_at: '2026-10-05T00:00:00Z',
};

describe('mergeResearchIntoBrief', () => {
  it('forces merged claims back to pending with web provenance', () => {
    const merged = mergeResearchIntoBrief(brief, {
      claims: [webClaim('new public claim')],
      sources: [
        {
          source_id: 'https://a.example',
          provider: 'exa',
          title: 'A',
          author: null,
          timestamp: null,
          url: 'https://a.example',
        },
      ],
    });
    const added = merged.claims.at(-1)!;
    expect(added.decision).toBe('pending');
    expect(added.provenance).toBe('web');
    // New evidence invalidates the prior approval — the brief re-enters review.
    expect(merged.status).toBe('draft');
    expect(merged.user_approved_at).toBeNull();
  });

  it('dedupes claims on normalized text', () => {
    const merged = mergeResearchIntoBrief(brief, {
      claims: [webClaim('Existing   kept CLAIM')],
      sources: [],
    });
    expect(merged.claims).toHaveLength(1);
  });
});
