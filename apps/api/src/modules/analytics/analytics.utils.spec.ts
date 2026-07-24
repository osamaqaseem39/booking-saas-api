import {
  ANALYTICS_MAX_PROPERTY_KEYS,
  outcomeFromEvent,
  validateAnalyticsEvent,
} from './analytics.utils';

describe('validateAnalyticsEvent', () => {
  const now = new Date('2026-07-22T10:00:00.000Z');

  const baseEvent = {
    event_id: '6e920d66-3906-48e7-a684-90f6330a6c98',
    occurred_at: '2026-07-22T09:55:00.000Z',
    anonymous_id: 'install_41e7',
    session_id: 'session_7c3a',
    screen_name: 'home',
    properties: {},
    context: {
      app_version: '1.4.0',
      build_number: '87',
      platform: 'android',
      os_version: '15',
      locale: 'en-PK',
      timezone: 'Asia/Karachi',
    },
  };

  it('accepts a valid vendor navigation event without anonymous_id', () => {
    const result = validateAnalyticsEvent(
      {
        event_id: '01JABC123',
        event_name: 'navigation_tab_selected',
        session_id: 'sess-1',
        properties: { tab_name: 'analytics', previous_tab: 'home' },
        app: { platform: 'android', version: '1.4.0', build: '104' },
        device: { locale: 'en-PK', timezone: 'Asia/Karachi' },
      },
      0,
      now,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.eventName).toBe('navigation_tab_selected');
      expect(result.value.anonymousId).toBe('sess-1');
    }
  });

  it('accepts a valid booking_started event', () => {
    const result = validateAnalyticsEvent(
      {
        ...baseEvent,
        event_name: 'booking_started',
        properties: {
          venue_id: '6e920d66-3906-48e7-a684-90f6330a6c98',
          sport: 'futsal',
          source: 'venue_details',
        },
      },
      0,
      now,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.eventName).toBe('booking_started');
      expect(result.value.context.app_version).toBe('1.4.0');
    }
  });

  it('rejects unknown event names', () => {
    const result = validateAnalyticsEvent(
      { ...baseEvent, event_name: 'random_click' },
      0,
      now,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects disallowed properties for an event', () => {
    const result = validateAnalyticsEvent(
      {
        ...baseEvent,
        event_name: 'venue_search',
        properties: { query: 'secret' },
      },
      0,
      now,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects too many property keys', () => {
    const properties: Record<string, string> = {};
    for (let i = 0; i < ANALYTICS_MAX_PROPERTY_KEYS + 1; i++) {
      properties[`k${i}`] = 'v';
    }
    const result = validateAnalyticsEvent(
      {
        ...baseEvent,
        event_name: 'venue_search_results',
        properties,
      },
      0,
      now,
    );
    expect(result.ok).toBe(false);
  });
});

describe('outcomeFromEvent', () => {
  it('classifies completed and failed events', () => {
    expect(outcomeFromEvent('booking_create_completed', {})).toBe('completed');
    expect(outcomeFromEvent('booking_create_failed', {})).toBe('failed');
    expect(outcomeFromEvent('booking_created_server', {})).toBe('completed');
    expect(outcomeFromEvent('booking_failed', { error_code: 'x' })).toBe('failed');
    expect(outcomeFromEvent('tournament_register_success', {})).toBe('completed');
    expect(outcomeFromEvent('login_failed', { method: 'otp' })).toBe('failed');
  });
});
