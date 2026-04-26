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
  'table-tennis': 'tennis',
};

const SPORT_LABEL: Record<BookingSportType, string> = {
  futsal: 'Futsal',
  cricket: 'Cricket',
  padel: 'Padel',
  'table-tennis': 'Table tennis',
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

/** Aligns with web “Booking from” and `source:*` in booking `notes` (e.g. `source:app`). */
export type BookingFromKey = 'walkin' | 'app' | 'call';

const BOOKING_FROM_ORDER: BookingFromKey[] = ['walkin', 'app', 'call'];

const BOOKING_FROM_LABEL: Record<BookingFromKey, string> = {
  walkin: 'Walk-in',
  app: 'App',
  call: 'Call',
};

/** Same as web `OverviewPage` SOURCE_COLORS. */
const BOOKING_FROM_COLOR: Record<BookingFromKey, string> = {
  walkin: '#6366f1',
  app: '#8b5cf6',
  call: '#ec4899',
};

/**
 * Parsed from `notes` — mirrors `bookingSourceFromRecord` in the web dashboard.
 * Defaults to walk-in when not tagged.
 */
export function parseBookingFromNotes(
  notes: string | undefined | null,
): BookingFromKey {
  const n = (notes ?? '').toLowerCase();
  const tagged = n.match(/source\s*:\s*(walkin|walk-in|app|call)\b/);
  if (tagged?.[1]) {
    return tagged[1] === 'walk-in' ? 'walkin' : (tagged[1] as BookingFromKey);
  }
  if (n.includes('walk-in') || n.includes('walkin')) return 'walkin';
  if (n.includes('call')) return 'call';
  if (n.includes('app')) return 'app';
  return 'walkin';
}

export type CustomersBySourceRow = {
  key: BookingFromKey;
  source: string;
  count: number;
  /** 0–100, integer share of bookings in the window. */
  percentage: number;
  color: string;
};

export type BookingFromPayload = {
  /** For donut / “total sources” style widgets. */
  totalBookings: number;
  /** Always three rows: Walk-in, App, Call. */
  sources: CustomersBySourceRow[];
};

/** “Booking from” / source analytics for API + mobile, period- or all-time scoped. */
export function buildBookingFromPayload(
  rows: Array<{ notes?: string }>,
): BookingFromPayload {
  const counts: Record<BookingFromKey, number> = {
    walkin: 0,
    app: 0,
    call: 0,
  };
  for (const b of rows) {
    counts[parseBookingFromNotes(b.notes)] += 1;
  }
  const totalBookings = rows.length;
  const sources: CustomersBySourceRow[] = BOOKING_FROM_ORDER.map((key) => {
    const count = counts[key];
    const percentage =
      totalBookings > 0
        ? Math.round((count / totalBookings) * 100)
        : 0;
    return {
      key,
      source: BOOKING_FROM_LABEL[key],
      count,
      percentage,
      color: BOOKING_FROM_COLOR[key],
    };
  });
  return { totalBookings, sources };
}

/**
 * Resolves a booking’s “primary” location from the first `items` line whose
 * `courtId` maps in `courtIdToLocationId` (courts at allowed branches).
 */
export function primaryLocationIdForBooking(
  booking: { items?: Array<{ courtId: string }> | null },
  courtIdToLocationId: ReadonlyMap<string, string>,
): string | null {
  for (const it of booking.items ?? []) {
    const loc = courtIdToLocationId.get(it.courtId);
    if (loc) {
      return loc;
    }
  }
  return null;
}

type DashboardBookRow = {
  sportType: string
  bookingStatus: string
  bookingDate: string
  totalAmount: string
  paymentStatus: string
  notes?: string
}

export function countBookingsKpis(
  rows: Array<{ bookingStatus: string; bookingDate: string }>,
  refToday: string,
) {
  return {
    upcoming: rows.filter(
      (b) => b.bookingStatus === 'confirmed' && b.bookingDate >= refToday,
    ).length,
    pending: rows.filter((b) => b.bookingStatus === 'pending').length,
    completed: rows.filter((b) => b.bookingStatus === 'completed').length,
    canceled: rows.filter((b) => b.bookingStatus === 'cancelled').length,
  };
}

/**
 * `totals`, `bookingStats`, `revenueOverview`, and booking-from for one slice
 * (e.g. whole account or a single location).
 */
export function buildDashboardStatsSlice(input: {
  period: DashboardPeriod
  refToday: string
  windowBookings: DashboardBookRow[]
  prevWindowBookings: DashboardBookRow[]
  allBookingsInScope: DashboardBookRow[]
  courtCount: number
  displayCurrency: string
  locCurrency: string
}) {
  const {
    period,
    refToday,
    windowBookings: w,
    prevWindowBookings: p,
    allBookingsInScope: all,
    courtCount,
    displayCurrency,
    locCurrency,
  } = input;

  const totalStats = {
    courtCount,
    bookingCount: w.length,
    confirmedBookingCount: w.filter(b => b.bookingStatus === 'confirmed').length,
    pendingBookingCount: w.filter(b => b.bookingStatus === 'pending').length,
    cancelledBookingCount: w.filter(b => b.bookingStatus === 'cancelled').length,
    completedBookingCount: w.filter(b => b.bookingStatus === 'completed').length,
    revenueTotal: w.reduce((acc, b) => acc + Number(b.totalAmount ?? 0), 0),
    revenuePaid: w.filter(b => b.paymentStatus === 'paid').reduce(
      (acc, b) => acc + Number(b.totalAmount ?? 0),
      0,
    ),
  };

  const curK = countBookingsKpis(w, refToday);
  const prevK = countBookingsKpis(p, refToday);

  const sportRevenue = new Map<string, number>();
  const sportCount = new Map<string, number>();
  for (const b of w) {
    const st = String(b.sportType || 'other').toLowerCase();
    const amt = Number(b.totalAmount ?? 0);
    sportRevenue.set(st, (sportRevenue.get(st) ?? 0) + amt);
    sportCount.set(st, (sportCount.get(st) ?? 0) + 1);
  }
  const revSum = totalStats.revenueTotal || 0;
  const bookSum = totalStats.bookingCount || 0;

  const sportKeys = [...sportRevenue.keys()].sort(
    (a, b) => (sportRevenue.get(b) ?? 0) - (sportRevenue.get(a) ?? 0),
  );
  const revenueBySport = sportKeys.map((k) => {
    const amount = Math.round((sportRevenue.get(k) ?? 0) * 100) / 100;
    return {
      sport: sportLabel(k),
      amount,
      icon: sportIcon(k),
      percentageOfRevenue: revSum > 0
        ? Math.round(((sportRevenue.get(k) ?? 0) / revSum) * 1000) / 10
        : 0,
    };
  });
  const bookingsBySport = sportKeys.map((k) => {
    const c = sportCount.get(k) ?? 0;
    return {
      sport: sportLabel(k),
      count: c,
      icon: sportIcon(k),
      percentageOfTotal: bookSum > 0
        ? Math.round((c / bookSum) * 1000) / 10
        : 0,
    };
  });

  const bookingFrom = buildBookingFromPayload(w);
  const bookingFromOverall = buildBookingFromPayload(all);

  return {
    totals: totalStats,
    bookingStats: [
      { label: 'Upcoming', value: curK.upcoming, change: period === 'all' ? '0' : formatStatChange(curK.upcoming, prevK.upcoming) },
      { label: 'Completed', value: curK.completed, change: period === 'all' ? '0' : formatStatChange(curK.completed, prevK.completed) },
      { label: 'Canceled', value: curK.canceled, change: period === 'all' ? '0' : formatStatChange(curK.canceled, prevK.canceled) },
      { label: 'Pending', value: curK.pending, change: period === 'all' ? '0' : formatStatChange(curK.pending, prevK.pending) },
    ],
    revenueOverview: {
      total: Math.round(revSum * 100) / 100,
      currency: displayCurrency,
      currencyCode: locCurrency,
      revenueBySport,
      bookingsBySport,
    },
    bookingFrom,
    bookingFromOverall,
    customersBySource: bookingFrom.sources,
    customersBySourceOverall: bookingFromOverall.sources,
  };
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
