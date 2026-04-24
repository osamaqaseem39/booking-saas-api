import {
  BOOKING_SPORT_TYPES,
  type BookingSportType,
  type PaymentMethod,
} from '../../bookings/types/booking.types';

export type DashboardPeriod = 'all' | 'today' | 'last7days' | 'thisMonth';

export function parseDashboardPeriod(raw?: string): DashboardPeriod {
  const p = (raw || 'all').trim().toLowerCase();
  if (p === 'today') return 'today';
  if (p === 'last7days' || p === 'last_7days' || p === 'last-7-days') {
    return 'last7days';
  }
  if (p === 'thismonth' || p === 'this_month' || p === 'this-month') {
    return 'thisMonth';
  }
  if (p === 'all' || p === '' || p === 'any' || p === 'lifetime') return 'all';
  return 'all';
}

/** Today YYYY-MM-DD in Asia/Karachi (aligns with existing “today” in booking flows). */
export function todayYmdKarachi(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive [start, end] for current period, or [null, null] for all-time. */
export function bookingDateWindow(
  period: DashboardPeriod,
  refToday: string = todayYmdKarachi(),
): { start: string | null; end: string | null } {
  if (period === 'all') {
    return { start: null, end: null };
  }
  if (period === 'today') {
    return { start: refToday, end: refToday };
  }
  if (period === 'last7days') {
    return { start: addDaysYmd(refToday, -6), end: refToday };
  }
  if (period === 'thisMonth') {
    const [y, m] = refToday.split('-').map((x) => Number(x));
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    return { start, end: refToday };
  }
  return { start: null, end: null };
}

export function previousWindowForDelta(
  period: DashboardPeriod,
  refToday: string = todayYmdKarachi(),
): { start: string | null; end: string | null } {
  if (period === 'all') {
    return { start: null, end: null };
  }
  if (period === 'today') {
    return { start: addDaysYmd(refToday, -1), end: addDaysYmd(refToday, -1) };
  }
  if (period === 'last7days') {
    return { start: addDaysYmd(refToday, -13), end: addDaysYmd(refToday, -7) };
  }
  if (period === 'thisMonth') {
    const [y, m, d] = refToday.split('-').map((x) => Number(x));
    const ref = new Date(Date.UTC(y, m - 1, 1));
    ref.setUTCMonth(ref.getUTCMonth() - 1);
    const y2 = ref.getUTCFullYear();
    const m2 = ref.getUTCMonth() + 1;
    const start = `${y2}-${String(m2).padStart(2, '0')}-01`;
    const endDay = Math.min(d, daysInMonth(y2, m2));
    const end = `${y2}-${String(m2).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    return { start, end };
  }
  return { start: null, end: null };
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function bookingInDateWindow(
  bookingDate: string,
  w: { start: string | null; end: string | null },
): boolean {
  if (w.start == null || w.end == null) return true;
  const d = bookingDate.slice(0, 10);
  return d >= w.start && d <= w.end;
}

const SPORT_ICONS: Record<BookingSportType, string> = {
  futsal: 'soccer',
  cricket: 'cricket',
  padel: 'tennis',
};

const SPORT_LABEL: Record<BookingSportType, string> = {
  futsal: 'Futsal',
  cricket: 'Cricket',
  padel: 'Padel',
};

export function sportLabel(sport: string): string {
  const k = String(sport || '').toLowerCase();
  if (BOOKING_SPORT_TYPES.includes(k as BookingSportType)) {
    return SPORT_LABEL[k as BookingSportType];
  }
  return sport || 'Other';
}

export function sportIcon(sport: string): string {
  const k = String(sport || '').toLowerCase();
  if (BOOKING_SPORT_TYPES.includes(k as BookingSportType)) {
    return SPORT_ICONS[k as BookingSportType];
  }
  return 'sports';
}

const SOURCE_COLOR_PALETTE = [
  '#1B8E3B',
  '#2E6BA8',
  '#4A4A4A',
  '#8E8E8E',
  '#C4C4C4',
  '#6B4B9A',
] as const;

/**
 * Heuristic “customer / acquisition source” for analytics (no extra DB field).
 * - Non-cash payment → App / online booking
 * - Cash + sport → walk-in label for that sport
 */
export function customerSourceKey(input: {
  sportType: string;
  paymentMethod: PaymentMethod | string;
}): string {
  const pm = String(input.paymentMethod || '').toLowerCase() as PaymentMethod;
  if (pm !== 'cash') {
    return 'App & online';
  }
  const st = String(input.sportType || '').toLowerCase() as BookingSportType;
  if (st === 'futsal') return 'Futsal walk-ins';
  if (st === 'cricket') return 'Cricket (walk-in)';
  if (st === 'padel') return 'Padel (walk-in)';
  return 'Walk-in (cash)';
}

export function colorForIndex(i: number): string {
  return SOURCE_COLOR_PALETTE[i % SOURCE_COLOR_PALETTE.length]!;
}

export function greetingTimeLabelKarachi(d = new Date()): {
  part: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
} {
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    hour: '2-digit',
    hour12: false,
  }).format(d);
  const hour = Number(hourStr) || 0;
  if (hour >= 5 && hour < 12) return { part: 'MORNING' };
  if (hour >= 12 && hour < 17) return { part: 'AFTERNOON' };
  if (hour >= 17 && hour < 22) return { part: 'EVENING' };
  return { part: 'NIGHT' };
}

export function currencyLabel(code: string | undefined | null): string {
  const c = String(code || 'PKR').toUpperCase();
  if (c === 'PKR' || c === 'RS' || c === 'INR' || c === 'BDT') return 'Rs.';
  return c;
}

export function formatStatChange(current: number, previous: number): string {
  const d = current - previous;
  if (d === 0) return '0';
  if (d > 0) return `+${d}`;
  return String(d);
}
