import type { ContextBrief, EvidenceClaim } from '@/hooks/use-conversation-state';
import { extractBriefFromPaste } from '@/lib/extract-evidence';

const MAX_TEXT_LENGTH = 20_000;

export const PLANS_URL =
  process.env.NEXT_PUBLIC_METTLE_PLANS_URL ||
  'https://mettle-xi.vercel.app/plans';

export type MeetingBriefResult = {
  counterpart_name: string;
  brief: ContextBrief;
  /** Counterpart pushbacks / questions the user should expect. */
  objections: string[];
  /** Short prep bullets derived from the thread (numbers, commitments, stakes). */
  prep_highlights: string[];
  /** Informational only — rehearsal/debrief are not free ChatGPT tools. */
  richer_actions: {
    status: 'account_or_product';
    message: string;
    plans_url: string;
  };
};

function clampText(text: string): string {
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
}

function asQuestion(claim: string): string {
  const trimmed = claim.trim().replace(/[.?!]+$/, '');
  if (/\?$/.test(claim.trim())) return claim.trim();
  // Soften statement → interview question without inventing new facts.
  if (/^(why|what|how|when|where|who|which)\b/i.test(trimmed)) {
    return `${trimmed}?`;
  }
  return `How will you address: ${trimmed}?`;
}

function uniquePreserveOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function objectionsFromBrief(brief: ContextBrief): string[] {
  const fromClaims = (brief.claims || [])
    .filter((c) => c.relevance === 'objection' || c.relevance === 'risk')
    .map((c) => asQuestion(c.claim));

  const fromHistory = (brief.counterpart_history || []).map(asQuestion);

  const timeline = (brief.claims || [])
    .filter((c) => c.relevance === 'timeline')
    .slice(0, 2)
    .map((c) => asQuestion(c.claim));

  return uniquePreserveOrder([...fromClaims, ...fromHistory, ...timeline]).slice(
    0,
    8,
  );
}

function highlightsFromBrief(brief: ContextBrief): string[] {
  const pick = (relevance: EvidenceClaim['relevance'], limit: number) =>
    (brief.claims || [])
      .filter((c) => c.relevance === relevance)
      .slice(0, limit)
      .map((c) => c.claim);

  return uniquePreserveOrder([
    ...pick('number', 3),
    ...pick('commitment', 3),
    ...pick('stakes', 2),
    ...(brief.open_commitments || []).slice(0, 3),
  ]).slice(0, 8);
}

function inferCounterpartName(
  brief: ContextBrief,
  fallback: string | undefined,
): string {
  if (fallback && fallback.trim()) return fallback.trim();
  const authors = (brief.sources || [])
    .map((s) => s.author)
    .filter((a): a is string => !!a && a.toLowerCase() !== 'you');
  return authors[0] || 'Counterpart';
}

/**
 * Free ChatGPT discovery wedge: paste thread → evidence brief + likely objections.
 * Deterministic / local — no side effects, no account required.
 */
export function buildMeetingBrief(
  text: string,
  counterpartName?: string,
): MeetingBriefResult {
  const cleaned = clampText((typeof text === 'string' ? text : '').trim());
  const brief = extractBriefFromPaste(
    cleaned,
    counterpartName?.trim() || 'Counterpart',
  );
  const name = inferCounterpartName(brief, counterpartName);
  let objections = objectionsFromBrief(brief);
  const prep_highlights = highlightsFromBrief(brief);

  if (objections.length === 0 && cleaned) {
    objections = [
      `What does ${name} still need to believe before saying yes?`,
      'What prior commitment or timeline will they reopen first?',
    ];
  }

  return {
    counterpart_name: name,
    brief,
    objections,
    prep_highlights,
    richer_actions: {
      status: 'account_or_product',
      message:
        'Rehearsal (opponent roleplay) and debrief are available in the Mettle product for users with an existing account. They are not part of this free ChatGPT tool. See the informational plans page — no in-plugin checkout.',
      plans_url: PLANS_URL,
    },
  };
}

export function formatMeetingBriefText(result: MeetingBriefResult): string {
  const lines: string[] = [
    `Meeting brief for ${result.counterpart_name}`,
    '',
    'Likely objections / questions:',
    ...(result.objections.length
      ? result.objections.map((o, i) => `${i + 1}. ${o}`)
      : ['(none extracted — paste a longer thread with pushback)']),
    '',
    'Prep highlights:',
    ...(result.prep_highlights.length
      ? result.prep_highlights.map((h) => `- ${h}`)
      : ['(no numbers/commitments classified yet)']),
    '',
    `Claims extracted: ${result.brief.claims.length} (pending human review in the full product)`,
    '',
    result.richer_actions.message,
    `Plans (informational): ${result.richer_actions.plans_url}`,
  ];
  return lines.join('\n');
}
