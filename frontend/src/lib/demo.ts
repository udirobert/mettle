/**
 * `?demo=fail` — degrade-on-purpose switch for rehearsing the no-creds path.
 *
 * Frontend fetches append the flag to backend proxy calls; the proxy answers
 * `degraded: true` without touching a real service. Nothing is hidden: the UI
 * shows the same degraded states a judge would see without credentials.
 */
export function demoFailEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('demo') === 'fail';
}

/** Append `demo=fail` to an API path when the page was loaded with it. */
export function withDemoParam(path: string): string {
  if (!demoFailEnabled()) return path;
  return `${path}${path.includes('?') ? '&' : '?'}demo=fail`;
}
