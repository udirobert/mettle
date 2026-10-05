/**
 * Stable memory key for a counterpart. Must match
 * `counterpart_key` in backend/context/memory.py, which is the pinned /memory
 * contract: lowercase, runs of non-alphanumerics become one dash, ends trimmed.
 */
export function counterpartRef(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
