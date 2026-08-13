import type { CoachAnalysis } from '@/hooks/use-conversation-state';

export type CouncilShareInput = {
  analysis: CoachAnalysis;
  counterpart: string;
  stakes?: string;
  anonymize?: boolean;
};

export type FollowUpMemoInput = {
  counterpart: string;
  stakes?: string;
  nextMove?: string;
  commitments: string[];
  stillOpen: string[];
  alsoDo: string[];
};

/** Agreed / split / move only — no transcript, no evidence claims. */
export function buildCouncilSplitText({
  analysis,
  counterpart,
  stakes,
  anonymize = false,
}: CouncilShareInput): string {
  const who = anonymize ? 'the counterpart' : counterpart;
  const stakesLine = anonymize
    ? 'A consequential conversation'
    : (stakes || 'High-stakes conversation').replace(/\.$/, '');
  const agreed = analysis.consensus?.[0] || 'No shared point named yet.';
  const split = analysis.disagreements?.[0] || 'No material conflict named.';
  const move =
    analysis.opening_strategy ||
    analysis.concrete_moves?.[0] ||
    `Ask ${who} what would make the decision simple.`;

  return [
    'Council split — Mettle',
    stakesLine,
    '',
    `They agreed: ${agreed}`,
    `They split: ${split}`,
    `The move: ${move}`,
    '',
    'No transcript. No private evidence.',
    anonymize ? undefined : `Counterpart: ${counterpart}`,
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}

/** Partner-forwardable follow-up — actions only, not the live record. */
export function buildFollowUpMemo({
  counterpart,
  stakes,
  nextMove,
  commitments,
  stillOpen,
  alsoDo,
}: FollowUpMemoInput): { subject: string; body: string } {
  const stakesClean = (stakes || 'our conversation').replace(/\.$/, '');
  const subject = `Follow-up — ${stakesClean}`;

  const sections: string[] = [
    `${counterpart},`,
    '',
    `Quick follow-up from ${stakesClean}.`,
    '',
  ];

  if (nextMove) {
    sections.push('Next move', `• ${nextMove}`, '');
  }
  if (commitments.length > 0) {
    sections.push('Commitments', ...commitments.map((item) => `• ${item}`), '');
  }
  if (stillOpen.length > 0) {
    sections.push('Still open', ...stillOpen.map((item) => `• ${item}`), '');
  }
  if (alsoDo.length > 0) {
    sections.push('Also', ...alsoDo.map((item) => `• ${item}`), '');
  }

  sections.push('I will take the next step on the item above.', '', 'Best');

  return { subject, body: sections.join('\n') };
}

export function buildMailtoHref(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
