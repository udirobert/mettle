/**
 * User-facing phase names. The principal runs the room; Mettle is staff.
 * Internal ids (prep/rehearsal/live/debrief) stay stable for state + URLs.
 */
export const PHASE_LABELS = {
  prep: 'Brief',
  rehearsal: 'Spar',
  live: 'Live',
  debrief: 'Close',
} as const;
