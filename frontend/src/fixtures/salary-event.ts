import type { MettleEvent } from './lp-event';

/**
 * The demo wedge. Dana is the hero event — a salary conversation deferred twice,
 * where the title is already won and only cash is open. The whole point of the
 * product is that this is the conversation you would rather not wing, so it is
 * what the docket leads with.
 *
 * Mirrors scenarios/salary_review.md. Keep the two in sync: the scenario file is
 * the backend's source of truth, this is its front-end shadow.
 */
export const SALARY_EVENT: MettleEvent = {
  id: 'salary_review',
  name: 'Comp review',
  counterpart: 'Dana Whitfield',
  counterpartRole: 'VP Product, Meridian Labs',
  stakes: "A long-deferred raise: $185k base and the senior title.",
  risk: 'High' as const,
  timeUntil: 'Thursday',
  counterpartProfile: {
    name: 'Dana Whitfield',
    role: 'VP Product, Meridian Labs',
    style: ['pragmatic', 'data-driven', 'budget-guarded', 'fair but firm'],
    leverage: 'Controls the comp recommendation; anything above band needs VP sign-off and the cycle closes this quarter.',
    concerns: [
      '$185k sits above the posted band for the current level.',
      'The business case must rest on scope and impact, not tenure or loyalty.',
      'Moving on title is easier for her than moving on cash this cycle.',
      'The team-health metrics promised after the March review were never delivered.',
    ],
  },
  userWeakPoints: [
    'May anchor too low to keep the conversation comfortable.',
    "May accept a vague 'next cycle' promise instead of a dated commitment.",
    'May over-justify with loyalty and effort rather than scope and impact.',
    'May concede the number before testing whether title plus scope is a real trade.',
  ],
};

/** The demo counterpart's pre-arrival homework, shown before the thread is read. */
export const SALARY_SCOUT_LOG: Array<{
  ts: string;
  actor: 'scout';
  action: string;
  detail: string;
  sources?: string[];
}> = [
  {
    ts: '2025-10-11T18:04:00Z',
    actor: 'scout',
    action: 'Thread received',
    detail: 'Read the forwarded Dana thread from your inbox — 3 messages.',
    sources: ['agentmail'],
  },
  {
    ts: '2025-10-11T18:04:20Z',
    actor: 'scout',
    action: 'Claims extracted',
    detail: '8 claims — 2 numbers, 3 objections, 1 open commitment, 2 timeline.',
    sources: ['agentmail'],
  },
  {
    ts: '2025-10-11T18:05:02Z',
    actor: 'scout',
    action: 'Homework done',
    detail: 'Pulled public comp-band data for VP-adjacent product roles in Meridian’s market.',
    sources: ['exa'],
  },
  {
    ts: '2025-10-11T18:05:30Z',
    actor: 'scout',
    action: 'Memory checked',
    detail: 'Last conversation with Dana was 14 months ago. One commitment was still open.',
    sources: ['memory'],
  },
  {
    ts: '2025-10-11T18:05:44Z',
    actor: 'scout',
    action: 'Flagged for you',
    detail: 'You committed to sending March team-health metrics. They never arrived — expect this to come up.',
    sources: ['memory'],
  },
];

/** Elena and the lighter events stay reachable as contrast cards. */
export { SALARY_EVENT as FEATURED_EVENT };
export type { MettleEvent };
