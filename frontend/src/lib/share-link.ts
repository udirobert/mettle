/**
 * Client-side share links for debrief memos.
 *
 * The memo payload is encoded into the URL fragment (#), so it never touches a
 * server, never gets logged by the host, and works on static hosting. The
 * payload intentionally excludes the transcript and evidence claims — only the
 * actions (commitments / still open / next moves) travel, honoring the
 * "the record stays folded" principle.
 */

export type SharedDebrief = {
  v: 1;
  counterpart: string;
  stakes?: string;
  savedAt: string;
  commitments: string[];
  stillOpen: string[];
  alsoDo: string[];
  source?: 'rehearsal' | 'live';
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice((text.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function encodeShareLink(payload: SharedDebrief): string {
  const json = new TextEncoder().encode(JSON.stringify(payload));
  return `${window.location.origin}/share#d=${toBase64Url(json)}`;
}

export function decodeShareLink(hash: string): SharedDebrief | null {
  const match = /(?:^#|&)d=([^&]+)/.exec(hash.startsWith('#') ? hash : `#${hash}`);
  if (!match) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(match[1])));
    if (
      parsed?.v === 1 &&
      typeof parsed.counterpart === 'string' &&
      Array.isArray(parsed.commitments)
    ) {
      return parsed as SharedDebrief;
    }
    return null;
  } catch {
    return null;
  }
}
