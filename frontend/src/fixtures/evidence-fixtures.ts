/**
 * Static evidence fixtures for demo scenarios.
 *
 * These simulate imported context from Gmail/Calendar/public research.
 * In production, this data would come from the context ingestion pipeline
 * (Composio, Exa, Firecrawl, etc.) after user approval.
 */

import type { ContextBrief } from '@/hooks/use-conversation-state';

const LP_RENEWAL_PRIVATE: ContextBrief = {
  status: 'approved',
  sources: [
    {
      source_id: 'email-elena-dpi',
      provider: 'gmail',
      title: 'Re: Q3 Performance Review',
      author: 'Elena Park',
      timestamp: '2024-10-15T14:30:00Z',
      url: null,
    },
    {
      source_id: 'email-user-memo',
      provider: 'gmail',
      title: 'Portfolio Construction Memo - Follow-up',
      author: 'You',
      timestamp: '2024-10-16T09:15:00Z',
      url: null,
    },
  ],
  claims: [
    {
      claim: 'Elena flagged DPI concerns and fee drag in Q3 performance review',
      source_ids: ['email-elena-dpi'],
      confidence: 'high',
      relevance: 'objection',
    },
    {
      claim: 'You committed to delivering a portfolio-construction memo before renewal',
      source_ids: ['email-user-memo'],
      confidence: 'high',
      relevance: 'commitment',
    },
    {
      claim: 'LP allocation under discussion is $40M',
      source_ids: ['email-elena-dpi', 'email-user-memo'],
      confidence: 'high',
      relevance: 'number',
    },
    {
      claim: 'Elena represents the second-largest investor; reputational impact if they reduce',
      source_ids: ['email-elena-dpi'],
      confidence: 'high',
      relevance: 'risk',
    },
  ],
  counterpart_history: [
    'Elena expressed concern about DPI in Q3 review',
    'Elena mentioned fee drag as a factor in allocation decisions',
    'Elena emphasized need for transparency on cash-back timing',
  ],
  open_commitments: [
    'Portfolio-construction memo promised before renewal discussion',
    'Follow-up on DPI improvement timeline',
  ],
  sensitive_redactions: [
    'Redacted: Internal IRR calculations from other LPs',
    'Redacted: Competitive fee comparison data',
  ],
  user_approved_at: '2024-11-10T16:45:00Z',
};

const LP_RENEWAL_RESEARCH: ContextBrief = {
  status: 'approved',
  sources: [
    {
      source_id: 'exa-market-dpi',
      provider: 'exa',
      title: 'LP Scrutiny on DPI and Distributions in 2024',
      author: 'Private Equity International',
      timestamp: '2024-11-01T00:00:00Z',
      url: 'https://example.com/dpi-trends-2024',
    },
    {
      source_id: 'exa-pension-fees',
      provider: 'exa',
      title: 'Pension Allocator Fee Sensitivity Analysis',
      author: 'Institutional Investor Research',
      timestamp: '2024-09-20T00:00:00Z',
      url: 'https://example.com/pension-fee-sensitivity',
    },
  ],
  claims: [
    {
      claim: 'LPs are scrutinizing DPI and distributions more heavily in 2024',
      source_ids: ['exa-market-dpi'],
      confidence: 'high',
      relevance: 'market',
    },
    {
      claim: 'Pension-style allocators tend to pressure fees when liquidity slows',
      source_ids: ['exa-pension-fees'],
      confidence: 'medium',
      relevance: 'counterpart',
    },
    {
      claim:
        'Private markets renewal conversations are more sensitive to cash-back timing than headline IRR',
      source_ids: ['exa-market-dpi'],
      confidence: 'high',
      relevance: 'market',
    },
  ],
  counterpart_history: [],
  open_commitments: [],
  sensitive_redactions: [],
  user_approved_at: '2024-11-10T16:45:00Z',
};

export function getScenarioEvidence(scenarioId: string): ContextBrief | null {
  if (scenarioId === 'lp_renewal') {
    return LP_RENEWAL_PRIVATE;
  }
  return null;
}

export function getScenarioResearch(scenarioId: string): ContextBrief | null {
  if (scenarioId === 'lp_renewal') {
    return LP_RENEWAL_RESEARCH;
  }
  return null;
}

export function hasApprovedEvidence(scenarioId: string): boolean {
  const brief = getScenarioEvidence(scenarioId);
  const research = getScenarioResearch(scenarioId);
  return (
    (brief?.status === 'approved' && brief.claims.length > 0) ||
    (research?.status === 'approved' && research.claims.length > 0)
  );
}
