/**
 * Everything Scout reads from the outside world — forwarded email, web
 * research — is untrusted data, never instructions. Tool results are cleaned
 * here before they can reach a model prompt.
 *
 * Mirrors backend/context/safety.py: drop whole suspicious lines rather than
 * trying to rewrite them.
 */

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all|any|the|your)?\s*(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(all|any|the|your)?\s*(previous|prior|above)/i,
  /(reveal|show|print|leak)\s+(your|the)\s+(system|hidden|initial)\s+(prompt|instructions?)/i,
  /you\s+are\s+now\s+(a|an|in)\b/i,
  /new\s+(system\s+)?instructions?\s*:/i,
  /<\s*\/?\s*(system|assistant|developer|tool)\s*>/i,
  /\bdo\s+not\s+follow\b.{0,40}\b(safety|policy|guardrail)/i,
  /\b(call|invoke|run|use)\s+(the\s+)?(tool|function|updateWorkingMemory)\b/i,
  /\bsend\s+(an?\s+)?(email|message)\s+to\b/i,
];

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;

export const MAX_UNTRUSTED_CHARS = 400;

export type Cleaned = { text: string; quarantined: boolean };

/** Clean one untrusted string: strip invisible/control characters, drop
 *  injection-looking lines, and cap the length. */
export function cleanUntrusted(input: unknown, maxChars = MAX_UNTRUSTED_CHARS): Cleaned {
  const raw = typeof input === "string" ? input : "";
  let quarantined = false;
  const kept: string[] = [];
  for (const line of raw.replace(CONTROL_CHARS, "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (INJECTION_PATTERNS.some((p) => p.test(trimmed))) {
      quarantined = true;
      continue;
    }
    kept.push(trimmed);
  }
  const text = kept.join(" ").slice(0, maxChars);
  return { text, quarantined };
}

/** Keep only well-formed http(s) URLs, origin + path (no query or fragment,
 *  which can carry tokens or tracking). */
export function safeUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  try {
    const u = new URL(input.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}

/** Redact secrets and URL query strings from text that may be logged or shown
 *  in a debug report. */
export function redact(text: string, limit = 500): string {
  return text
    .replace(/https?:\/\/[^\s"<>]+/gi, (url) => safeUrl(url) ?? "[url]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(
      /((?:api[_-]?key|token|password|secret|authorization|cookie)\s*[=:]\s*)[^\s,;]+/gi,
      "$1[redacted]",
    )
    .replace(/\bnt_live_[A-Za-z0-9_-]+/g, "[redacted]")
    .slice(0, limit);
}
