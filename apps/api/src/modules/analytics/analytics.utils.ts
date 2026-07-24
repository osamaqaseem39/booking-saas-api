import { createHash } from 'crypto';
import { redactSensitivePayload } from '../audit/audit.utils';
import {
  allowedPropertyKeysForEvent,
  isAllowedEventName,
  isVendorEventName,
} from './analytics-event-catalog';

export const ANALYTICS_MAX_BATCH_SIZE = 50;
export const ANALYTICS_MAX_PROPERTY_KEYS = 25;
export const ANALYTICS_MAX_PROPERTY_VALUE_LENGTH = 100;
export const ANALYTICS_MAX_EVENT_BYTES = 32_768;
export const ANALYTICS_RETENTION_DAYS = 395;

const EVENT_NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BLOCKED_PROPERTY_KEYS = new Set([
  'email',
  'phone',
  'phonenumber',
  'fullname',
  'name',
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
  'apikey',
  'note',
  'notes',
  'query',
  'searchquery',
  'url',
]);

const CONTEXT_KEYS = new Set([
  'app_version',
  'build_number',
  'platform',
  'os_version',
  'locale',
  'timezone',
]);

export type AnalyticsEventInput = {
  event_id?: string;
  event_name?: string;
  occurred_at?: string;
  anonymous_id?: string;
  session_id?: string;
  user_id?: string;
  screen_name?: string;
  properties?: Record<string, unknown>;
  context?: Record<string, unknown>;
  app?: {
    platform?: string;
    version?: string;
    build?: string;
  };
  device?: {
    locale?: string;
    timezone?: string;
  };
};

export type ValidatedAnalyticsEvent = {
  eventId: string;
  eventName: string;
  occurredAt: Date;
  anonymousId: string;
  sessionId: string | null;
  screenName: string | null;
  platform: string | null;
  appVersion: string | null;
  appBuild: string | null;
  context: Record<string, unknown>;
  properties: Record<string, unknown>;
  locationIdFromProperties: string | null;
};

export function hashSourceIp(ip: string | null | undefined): string | null {
  const trimmed = (ip ?? '').trim();
  if (!trimmed) return null;
  const salt = process.env.ANALYTICS_IP_HASH_SALT ?? 'velay-analytics';
  return createHash('sha256')
    .update(`${salt}:${trimmed}`)
    .digest('hex')
    .slice(0, 32);
}

export function validateAnalyticsEvent(
  raw: AnalyticsEventInput,
  index: number,
  now = new Date(),
): { ok: true; value: ValidatedAnalyticsEvent } | { ok: false; error: string } {
  const eventId = (raw.event_id ?? '').trim();
  if (!eventId || eventId.length > 64) {
    return { ok: false, error: `events[${index}].event_id is required (max 64 chars)` };
  }

  const eventName = (raw.event_name ?? '').trim();
  if (!EVENT_NAME_RE.test(eventName)) {
    return {
      ok: false,
      error: `events[${index}].event_name must be 1-64 lowercase snake_case characters`,
    };
  }
  if (!isAllowedEventName(eventName)) {
    return {
      ok: false,
      error: `events[${index}].event_name is not in the analytics allowlist`,
    };
  }

  const occurredAtRaw = (raw.occurred_at ?? '').trim();
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : now;
  if (occurredAtRaw && Number.isNaN(occurredAt.getTime())) {
    return { ok: false, error: `events[${index}].occurred_at is invalid` };
  }
  if (!occurredAtRaw && !isVendorEventName(eventName)) {
    return { ok: false, error: `events[${index}].occurred_at is required` };
  }
  const maxPastMs = 7 * 24 * 60 * 60 * 1000;
  const maxFutureMs = 5 * 60 * 1000;
  const delta = occurredAt.getTime() - now.getTime();
  if (delta < -maxPastMs || delta > maxFutureMs) {
    return { ok: false, error: `events[${index}].occurred_at is out of allowed range` };
  }

  const anonymousId = (raw.anonymous_id ?? '').trim();
  if (!anonymousId && !isVendorEventName(eventName)) {
    return {
      ok: false,
      error: `events[${index}].anonymous_id is required (max 100 chars)`,
    };
  }
  if (anonymousId && anonymousId.length > 100) {
    return {
      ok: false,
      error: `events[${index}].anonymous_id exceeds 100 chars`,
    };
  }

  const sessionId = (raw.session_id ?? '').trim();
  if (!sessionId && !isVendorEventName(eventName)) {
    return {
      ok: false,
      error: `events[${index}].session_id is required (max 64 chars)`,
    };
  }
  if (sessionId && sessionId.length > 64) {
    return {
      ok: false,
      error: `events[${index}].session_id exceeds 64 chars`,
    };
  }

  const screenName = (raw.screen_name ?? '').trim();
  if (!screenName && !isVendorEventName(eventName)) {
    return {
      ok: false,
      error: `events[${index}].screen_name is required (max 80 chars)`,
    };
  }
  if (screenName && screenName.length > 80) {
    return {
      ok: false,
      error: `events[${index}].screen_name exceeds 80 chars`,
    };
  }

  const contextResult = sanitizeContext(raw, index);
  if (!contextResult.ok) return contextResult;

  const propertiesResult = sanitizeAnalyticsProperties(
    raw.properties ?? {},
    index,
    eventName,
  );
  if (!propertiesResult.ok) return propertiesResult;

  const payloadBytes = byteLength({
    event_id: eventId,
    event_name: eventName,
    occurred_at: occurredAt.toISOString(),
    anonymous_id: anonymousId,
    session_id: sessionId,
    screen_name: screenName,
    properties: propertiesResult.value,
    context: contextResult.value,
  });
  if (payloadBytes > ANALYTICS_MAX_EVENT_BYTES) {
    return {
      ok: false,
      error: `events[${index}] exceeds ${ANALYTICS_MAX_EVENT_BYTES} bytes`,
    };
  }

  const locationIdFromProperties = resolveVenueId(propertiesResult.value);

  return {
    ok: true,
    value: {
      eventId,
      eventName,
      occurredAt,
      anonymousId: anonymousId || sessionId || 'vendor',
      sessionId: sessionId || null,
      screenName: screenName || null,
      platform: stringOrNull(contextResult.value.platform, 16),
      appVersion: stringOrNull(contextResult.value.app_version, 32),
      appBuild: stringOrNull(contextResult.value.build_number, 32),
      context: contextResult.value,
      properties: propertiesResult.value,
      locationIdFromProperties,
    },
  };
}

function sanitizeContext(
  raw: AnalyticsEventInput,
  index: number,
):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string } {
  const merged: Record<string, unknown> = { ...(raw.context ?? {}) };

  if (raw.app?.platform) merged.platform = raw.app.platform;
  if (raw.app?.version) merged.app_version = raw.app.version;
  if (raw.app?.build) merged.build_number = raw.app.build;
  if (raw.device?.locale) merged.locale = raw.device.locale;
  if (raw.device?.timezone) merged.timezone = raw.device.timezone;

  for (const key of Object.keys(merged)) {
    if (!CONTEXT_KEYS.has(key)) {
      return {
        ok: false,
        error: `events[${index}].context.${key} is not allowed`,
      };
    }
  }

  const sanitized: Record<string, unknown> = {};
  for (const key of CONTEXT_KEYS) {
    const value = merged[key];
    if (value === undefined || value === null || value === '') continue;
    sanitized[key] = String(value).slice(0, key === 'timezone' ? 64 : 32);
  }

  return { ok: true, value: sanitized };
}

function sanitizeAnalyticsProperties(
  properties: Record<string, unknown>,
  index: number,
  eventName: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const allowedKeys = allowedPropertyKeysForEvent(eventName);
  if (!allowedKeys) {
    return {
      ok: false,
      error: `events[${index}].event_name has no property schema configured`,
    };
  }

  const keys = Object.keys(properties);
  if (keys.length > ANALYTICS_MAX_PROPERTY_KEYS) {
    return {
      ok: false,
      error: `events[${index}].properties exceeds ${ANALYTICS_MAX_PROPERTY_KEYS} keys`,
    };
  }

  for (const key of keys) {
    if (!allowedKeys.has(key)) {
      return {
        ok: false,
        error: `events[${index}].properties.${key} is not allowed for ${eventName}`,
      };
    }
    const normalized = key.toLowerCase().replace(/[-_]/g, '');
    if (BLOCKED_PROPERTY_KEYS.has(normalized)) {
      return {
        ok: false,
        error: `events[${index}].properties.${key} is not allowed`,
      };
    }
  }

  const redacted = redactSensitivePayload(properties) as Record<string, unknown>;
  const bounded = boundPropertyValues(redacted, index);
  if (!bounded.ok) return bounded;

  const piiCheck = findPiiInValue(bounded.value);
  if (piiCheck) {
    return {
      ok: false,
      error: `events[${index}].properties contains disallowed PII (${piiCheck})`,
    };
  }

  return { ok: true, value: bounded.value };
}

function boundPropertyValues(
  properties: Record<string, unknown>,
  index: number,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') {
      out[key] = value.slice(0, ANALYTICS_MAX_PROPERTY_VALUE_LENGTH);
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
      continue;
    }
    return {
      ok: false,
      error: `events[${index}].properties.${key} must be a string, number, or boolean`,
    };
  }
  return { ok: true, value: out };
}

function resolveVenueId(properties: Record<string, unknown>): string | null {
  const venueId = properties.venue_id;
  if (typeof venueId === 'string' && /^[0-9a-f-]{36}$/i.test(venueId)) {
    return venueId;
  }
  const locationId = properties.location_id;
  if (typeof locationId === 'string' && /^[0-9a-f-]{36}$/i.test(locationId)) {
    return locationId;
  }
  return null;
}

function findPiiInValue(value: unknown, path = ''): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    if (UUID_RE.test(value)) return null;
    if (EMAIL_RE.test(value)) return path || 'email_pattern';
    if (PHONE_RE.test(value)) return path || 'phone_pattern';
    if (value.includes('?') && /^https?:\/\//i.test(value)) {
      return path || 'url_with_query';
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findPiiInValue(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const hit = findPiiInValue(v, path ? `${path}.${k}` : k);
      if (hit) return hit;
    }
  }
  return null;
}

function stringOrNull(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function byteLength(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return ANALYTICS_MAX_EVENT_BYTES + 1;
  }
}

export function outcomeFromEvent(
  eventName: string,
  properties: Record<string, unknown>,
): 'attempted' | 'completed' | 'failed' | 'neutral' {
  const result = String(properties.result ?? '').toLowerCase();
  if (result === 'success' || result === 'completed') return 'completed';
  if (result === 'failed' || result === 'error') return 'failed';
  if (eventName.endsWith('_success') || eventName.endsWith('_completed')) {
    return 'completed';
  }
  if (eventName.endsWith('_failed')) return 'failed';
  if (eventName.endsWith('_started') || eventName.endsWith('_opened')) {
    return 'attempted';
  }
  if (eventName === 'purchase' || eventName === 'booking_created_server') {
    return 'completed';
  }
  return 'neutral';
}
