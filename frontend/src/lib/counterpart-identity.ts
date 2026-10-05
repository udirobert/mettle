import { counterpartRef } from './counterpart-ref';

/**
 * Who a counterpart *is*: a name plus an organisation, so two different
 * "Dana"s do not share a memory. This mirrors `organization_key` /
 * `counterpart_key` in backend/context/memory.py, and both are tested against
 * one shared table of vectors — change them together.
 *
 *   "Meridian Labs, Inc." and "meridianlabs.com" both → "meridianlabs"
 *   name "Dana Whitfield" + that org → "dana-whitfield--meridianlabs"
 *   no organisation known → the legacy name-only ref "dana-whitfield"
 */
const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
  'msn.com', 'yahoo.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me',
  'protonmail.com', 'gmx.com', 'fastmail.com', 'hey.com',
]); // prettier-ignore
const LEGAL_SUFFIXES = new Set([
  'inc', 'llc', 'ltd', 'corp', 'corporation', 'co', 'company', 'limited',
  'gmbh', 'plc', 'sa', 'ag', 'bv', 'pty',
]); // prettier-ignore
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu']);
const DOMAIN = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

export function organizationKey(organization?: string | null): string {
  let text = (organization ?? '').trim().toLowerCase();
  if (text.includes('@')) text = text.slice(text.lastIndexOf('@') + 1).trim();
  if (!text) return '';
  if (DOMAIN.test(text)) {
    if (FREE_MAIL.has(text)) return '';
    let labels = text.split('.').slice(0, -1); // drop the TLD
    if (labels.length >= 2 && SECOND_LEVEL.has(labels[labels.length - 1])) {
      labels = labels.slice(0, -1); // meridianlabs.co.uk -> meridianlabs
    }
    return labels.length ? labels[labels.length - 1].replace(/[^a-z0-9]/g, '') : '';
  }
  const tokens = text.match(/[a-z0-9]+/g) ?? [];
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join('');
}

/** The memory ref for this person: qualified when an organisation is known. */
export function memoryRef(name: string, organization?: string | null): string {
  const base = counterpartRef(name);
  const org = organizationKey(organization);
  return base && org ? `${base}--${org}` : base;
}

/** Refs to try, most specific first. The name-only ref is the pre-organisation record. */
export function memoryRefCandidates(
  name: string,
  organization?: string | null,
): Array<{ ref: string; confirmed: boolean }> {
  const qualified = memoryRef(name, organization);
  const legacy = counterpartRef(name);
  if (!legacy) return [];
  return qualified !== legacy
    ? [
        { ref: qualified, confirmed: true },
        { ref: legacy, confirmed: false },
      ]
    : [{ ref: legacy, confirmed: false }];
}

/** Browser-local keys for the debrief record and the carried-over open items. */
export function localMemoryKeys(ref: string) {
  return { debrief: `mettle.debrief.${ref}`, carry: `mettle.carry.${ref}` };
}

type MiniStorage = Pick<Storage, 'getItem' | 'removeItem'>;

/**
 * Forget the browser-local copies for one ref. Returns how many carried-over
 * open items were removed, so the UI can say what it actually did.
 */
export function clearLocalMemory(storage: MiniStorage, ref: string): number {
  const keys = localMemoryKeys(ref);
  let carried = 0;
  try {
    const raw = storage.getItem(keys.carry);
    if (raw) carried = (JSON.parse(raw) as { items?: unknown[] }).items?.length ?? 0;
  } catch {
    /* unreadable marker: still remove it below */
  }
  try {
    storage.removeItem(keys.carry);
    storage.removeItem(keys.debrief);
  } catch {
    /* storage unavailable */
  }
  return carried;
}

/** Carried-over open items for one ref (0 when none or unreadable). */
export function readCarryCount(storage: MiniStorage, ref: string): number {
  try {
    const raw = storage.getItem(localMemoryKeys(ref).carry);
    if (!raw) return 0;
    return (JSON.parse(raw) as { items?: unknown[] }).items?.length ?? 0;
  } catch {
    return 0;
  }
}
