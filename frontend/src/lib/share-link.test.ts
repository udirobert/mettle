import { describe, expect, it } from 'vitest';

import { decodeShareLink, encodeShareLink, type SharedDebrief } from './share-link';

const payload: SharedDebrief = {
  v: 1,
  counterpart: 'Dana Whitfield',
  stakes: 'Salary review — scope case',
  savedAt: '2026-10-05T00:00:00.000Z',
  commitments: ['Send the team-health metrics by Friday'],
  stillOpen: ['Title change deferred to Q1'],
  alsoDo: ['Book the follow-up'],
  source: 'live',
};

describe('share link round trip', () => {
  it('decodes exactly what it encodes', () => {
    const link = encodeShareLink(payload, 'https://mettle.example');
    expect(link.startsWith('https://mettle.example/share#d=')).toBe(true);
    const hash = link.slice(link.indexOf('#'));
    expect(decodeShareLink(hash)).toEqual(payload);
  });

  it('round-trips unicode and empty arrays', () => {
    const unicode: SharedDebrief = {
      ...payload,
      commitments: ['We’ll revisit — “scope first”'],
      stillOpen: [],
      alsoDo: [],
    };
    const link = encodeShareLink(unicode, 'https://mettle.example');
    expect(decodeShareLink(link.slice(link.indexOf('#')))).toEqual(unicode);
  });

  it('rejects malformed and foreign payloads', () => {
    expect(decodeShareLink('#d=not-base64!!!')).toBeNull();
    expect(decodeShareLink('#x=1')).toBeNull();
    expect(decodeShareLink('')).toBeNull();
    const wrongVersion = encodeShareLink({ ...payload, v: 2 } as never, 'https://x');
    expect(decodeShareLink(wrongVersion.slice(wrongVersion.indexOf('#')))).toBeNull();
  });
});
