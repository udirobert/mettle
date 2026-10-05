'use client';

/**
 * The user's own display name, kept in localStorage — no auth. Used to make
 * transcript attribution personal ("Jordan" rather than "Me") without any
 * account machinery. Not a claim source and never sent as evidence.
 */
export const USER_NAME_KEY = 'mettle.user_name';
export const USER_NAME_EVENT = 'mettle:user-name';

export function readUserName(): string {
  try {
    return window.localStorage.getItem(USER_NAME_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function writeUserName(name: string) {
  try {
    const trimmed = name.trim();
    if (trimmed) window.localStorage.setItem(USER_NAME_KEY, trimmed);
    else window.localStorage.removeItem(USER_NAME_KEY);
    window.dispatchEvent(new Event(USER_NAME_EVENT));
  } catch {
    /* storage unavailable — the demo stays anonymous */
  }
}
