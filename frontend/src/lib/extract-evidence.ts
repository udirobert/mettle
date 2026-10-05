import type { ContextBrief, EvidenceClaim } from '@/hooks/use-conversation-state';

export const SAMPLE_ELENA_THREAD = `From: Elena Park
Date: 15 Oct 2024
Subject: Re: Q3 Performance Review

Before we discuss a new commitment, I need a clearer picture of the liquidity timeline. DPI has lagged what we were led to expect at the last renewal. The fee step-up is hard to defend while cash-back is slow.

From: You
Date: 16 Oct 2024
Subject: Portfolio Construction Memo — Follow-up

Understood. I will send the portfolio-construction memo before we meet. The $40M renewal is the ask. Two concentrated positions still dominate unrealized value; the memo will address how we de-risk that.
`;

/**
 * Seed thread for the salary-review demo — the moment the whole pitch opens on.
 *
 * Forwarded to the agent's own inbox (or pasted into the Coach room) this thread
 * has to yield the claims the demo leans on: the above-band number, the peer
 * compression pressure, the "title yes / cash needs sign-off" split, and one
 * commitment the user forgot making — which is the beat that proves the agent
 * read something they did not.
 */
export const SAMPLE_DANA_THREAD = `From: Dana Whitfield
Date: 9 Oct 2025
Subject: Comp cycle — let's get you booked

Let's get you into the cycle before it closes. Fair warning: $185k is above the posted band for your current level, so I need a real scope case, not a tenure case. Also flagging that two peers on your team filed comp complaints after the March review, which means any exception I make becomes precedent I have to defend upstairs.

From: You
Date: 10 Oct 2025
Subject: Re: Comp cycle — let's get you booked

To be direct about where I land: I'm asking for $185k base and the senior title. I know the band is the constraint. Happy to take on the platform reorg if comp can follow in the next cycle once the migration lands — that was the deal I proposed back in March and I'm still fine with it.

From: Dana Whitfield
Date: 11 Oct 2025
Subject: Re: Comp cycle — let's get you booked

Title is realistic and I can move on it. Cash is the hard part — anything above band needs VP sign-off and the calendar closes this quarter. And I want to flag the March team-health metrics: you committed to sending those and they never arrived, so right now my reliability case for you is thinner than the scope case. Let's talk Thursday.
`;

const MONEY = /\$[\d,.]+(?:\s*(?:[Mm]|million))?/;
const COMMIT = /\b(commit(?:ted|ment)?|promis(?:e|ed)|will send|follow-?up|memo)\b/i;
const OBJECTION = /\b(concern|flagged|lag(?:ged)?|skeptic|hard to defend|worry|object|behind|lack)\b/i;
const RISK = /\b(reduc(?:e|ed)|risk|reputational|unwind|concentrat)\b/i;
const TIMELINE = /\b(timeline|before we meet|deadline|Q[1-4]|this time)\b/i;
const HEADER = /^(From|Date|Subject|To|Cc):\s*/i;

function classify(sentence: string): EvidenceClaim['relevance'] | null {
  if (MONEY.test(sentence)) return 'number';
  if (COMMIT.test(sentence)) return 'commitment';
  if (OBJECTION.test(sentence)) return 'objection';
  if (RISK.test(sentence)) return 'risk';
  if (TIMELINE.test(sentence)) return 'timeline';
  return null;
}

function splitBlocks(text: string): string[] {
  const parts = text
    .split(/(?=(?:^|\n)From:\s*)/i)
    .map((block) => block.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text.trim()];
}

function bodySentences(block: string): string[] {
  const body = block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !HEADER.test(line))
    .join(' ');
  return body
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 24);
}

function headerValue(block: string, label: string): string | null {
  const match = block.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'));
  return match?.[1]?.trim() ?? null;
}

/** Local fallback if the agent extract endpoint is unreachable. */
export function extractBriefFromPaste(
  text: string,
  counterpartName = 'Elena Park',
): ContextBrief {
  const cleaned = text.trim();
  const empty: ContextBrief = {
    status: 'draft',
    sources: [],
    claims: [],
    counterpart_history: [],
    open_commitments: [],
    sensitive_redactions: [],
    user_approved_at: null,
  };
  if (!cleaned) return empty;

  const blocks = splitBlocks(cleaned);
  const brief: ContextBrief = { ...empty, sources: [], claims: [] };

  blocks.forEach((block, index) => {
    const sourceId = `paste-${index + 1}`;
    const author = headerValue(block, 'From') || counterpartName;
    brief.sources.push({
      source_id: sourceId,
      provider: 'manual',
      title: headerValue(block, 'Subject') || `Pasted thread ${index + 1}`,
      author,
      timestamp: headerValue(block, 'Date'),
      url: null,
    });

    for (const sentence of bodySentences(block)) {
      const relevance = classify(sentence);
      if (!relevance) continue;
      const claim = sentence.replace(/[.]$/, '');
      brief.claims.push({
        claim,
        source_ids: [sourceId],
        confidence: relevance === 'number' || relevance === 'commitment' ? 'high' : 'medium',
        relevance,
        decision: 'pending',
      });
      if (relevance === 'commitment') brief.open_commitments.push(claim);
      if (author.toLowerCase() !== 'you' && ['objection', 'risk', 'number'].includes(relevance)) {
        brief.counterpart_history.push(claim);
      }
    }
  });

  if (brief.claims.length === 0) {
    blocks.forEach((block, index) => {
      for (const sentence of bodySentences(block).slice(0, 2)) {
        brief.claims.push({
          claim: sentence.replace(/[.]$/, ''),
          source_ids: [`paste-${index + 1}`],
          confidence: 'medium',
          relevance: 'counterpart',
          decision: 'pending',
        });
      }
    });
  }

  return brief;
}
