const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

/** Reduces Prometheus label cardinality and groups audit rows by route pattern. */
export function normalizeHttpPath(path: string): string {
  const base = path.split('?')[0] ?? path;
  return base.replace(UUID_RE, ':uuid');
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
  'apikey',
  'api_key',
]);

export function redactSensitivePayload(
  value: unknown,
  depth = 0,
): unknown {
  if (depth > 8) return '[truncated-depth]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redactSensitivePayload(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lk = k.toLowerCase().replace(/[-_]/g, '');
      if (SENSITIVE_KEYS.has(lk)) {
        out[k] = '[redacted]';
      } else {
        out[k] = redactSensitivePayload(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

const MAX_JSON_BYTES = 24_000;

export function capJsonForAudit(value: unknown): unknown {
  try {
    const s = JSON.stringify(value);
    if (s.length <= MAX_JSON_BYTES) return value;
    return { _truncated: true, preview: s.slice(0, MAX_JSON_BYTES) };
  } catch {
    return { _error: 'non-serializable-body' };
  }
}
