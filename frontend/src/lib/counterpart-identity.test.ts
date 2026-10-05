import { describe, expect, it } from 'vitest';
import {
  clearLocalMemory,
  localMemoryKeys,
  memoryRef,
  memoryRefCandidates,
  organizationKey,
  readCarryCount,
} from './counterpart-identity';

// The same table as backend/tests/test_memory.py (IdentityTests). If one side
// changes, change both — that is the whole point of these vectors.
const ORGANIZATION_VECTORS: Array<[string, string]> = [
  ['Meridian Labs', 'meridianlabs'],
  ['Meridian Labs, Inc.', 'meridianlabs'],
  ['meridianlabs.com', 'meridianlabs'],
  ['mail.meridianlabs.co.uk', 'meridianlabs'],
  ['@meridianlabs.com', 'meridianlabs'],
  ['dana.whitfield@meridianlabs.com', 'meridianlabs'],
  ['dana@gmail.com', ''],
  ['Acme Co', 'acme'],
  ['gmail.com', ''],
  ['', ''],
];
const KEY_VECTORS: Array<[[string, string | null], string]> = [
  [['Dana Whitfield', null], 'dana-whitfield'],
  [['Dana Whitfield', 'Meridian Labs'], 'dana-whitfield--meridianlabs'],
  [['Dana Whitfield', 'dana@gmail.com'], 'dana-whitfield'],
  [['Dana Whitfield', 'meridianlabs.com'], 'dana-whitfield--meridianlabs'],
  [[' Dana  Reyes! ', 'Reyes & Co'], 'dana-reyes--reyes'],
];

describe('identity parity with the backend', () => {
  it.each(ORGANIZATION_VECTORS)('organizationKey(%j) = %j', (raw, expected) => {
    expect(organizationKey(raw)).toBe(expected);
  });
  it('tolerates null and undefined', () => {
    expect(organizationKey(null)).toBe('');
    expect(organizationKey(undefined)).toBe('');
  });
  it.each(KEY_VECTORS)('memoryRef(%j) = %j', ([name, org], expected) => {
    expect(memoryRef(name, org)).toBe(expected);
  });
});

describe('identity behaviour', () => {
  it('a company name and an email domain are the same place', () => {
    expect(memoryRef('Dana Whitfield', 'Meridian Labs')).toBe(
      memoryRef('Dana Whitfield', 'meridianlabs.com'),
    );
  });
  it('two people with one name differ by organisation', () => {
    expect(memoryRef('Dana Whitfield', 'meridianlabs.com')).not.toBe(
      memoryRef('Dana Whitfield', 'acme.io'),
    );
  });
  it('tries the qualified ref first, then the unconfirmed name-only one', () => {
    expect(memoryRefCandidates('Dana Whitfield', 'Meridian Labs')).toEqual([
      { ref: 'dana-whitfield--meridianlabs', confirmed: true },
      { ref: 'dana-whitfield', confirmed: false },
    ]);
    expect(memoryRefCandidates('Dana Whitfield')).toEqual([
      { ref: 'dana-whitfield', confirmed: false },
    ]);
    expect(memoryRefCandidates('!!!')).toEqual([]);
  });
});

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('local memory', () => {
  const ref = 'dana-whitfield--meridianlabs';
  const keys = localMemoryKeys(ref);

  it('clears the debrief record and the carry marker, and reports what was carried', () => {
    const storage = fakeStorage({
      [keys.carry]: JSON.stringify({ items: ['a', 'b', 'c'] }),
      [keys.debrief]: '{"notes":[]}',
      [localMemoryKeys('someone-else').carry]: '{"items":["x"]}',
    });
    expect(clearLocalMemory(storage, ref)).toBe(3);
    expect(storage.data.has(keys.carry)).toBe(false);
    expect(storage.data.has(keys.debrief)).toBe(false);
  });

  it('leaves other people alone', () => {
    const other = localMemoryKeys('someone-else').carry;
    const storage = fakeStorage({ [other]: '{"items":["x"]}' });
    clearLocalMemory(storage, ref);
    expect(storage.data.has(other)).toBe(true);
  });

  it('still removes an unreadable marker', () => {
    const storage = fakeStorage({ [keys.carry]: '{not json' });
    expect(clearLocalMemory(storage, ref)).toBe(0);
    expect(storage.data.has(keys.carry)).toBe(false);
  });

  it('reads the carry count, tolerating absence and junk', () => {
    expect(readCarryCount(fakeStorage(), ref)).toBe(0);
    expect(readCarryCount(fakeStorage({ [keys.carry]: '{"items":["a","b"]}' }), ref)).toBe(2);
    expect(readCarryCount(fakeStorage({ [keys.carry]: 'nope' }), ref)).toBe(0);
  });
});
