/**
 * Heuristic extraction of booking fields from unstructured text (WhatsApp, SMS, notes).
 * Tuned for Pakistan padel venues: PK phones, Rs/PKR amounts, English month/day, 12h times.
 */

const MONTH_WORD: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function ymdFromParts(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function parseMonthToken(t: string): number | null {
  const k = t.toLowerCase().replace(/\./g, '');
  return MONTH_WORD[k] ?? null;
}

function minutesToHHmm(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function parse12hToMinutes(
  hour: number,
  minute: number,
  ap: string,
): number | null {
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  const up = ap.toUpperCase();
  let h = hour % 12;
  if (up.startsWith('P')) h += 12;
  return h * 60 + minute;
}

export type FreeTextBookingParseResult = {
  customerName: string | null;
  /** Local mobile digits (e.g. 3343544353 without country code). */
  phoneDigits: string | null;
  bookingDate: string | null;
  startTime: string | null;
  endTime: string | null;
  amount: number | null;
  /** Raw court phrase from text, e.g. "Padel Court 1". */
  courtPhrase: string | null;
  courtNumber: number | null;
  inferredSport: 'padel' | 'futsal' | 'cricket' | 'table-tennis' | null;
  warnings: string[];
};

function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function extractPhone(text: string): string | null {
  const intl = text.match(/\b(?:\+|00)92\s*0?3\d{9}\b/);
  if (intl) {
    let d = intl[0].replace(/\D/g, '');
    if (d.startsWith('92')) d = d.slice(2);
    if (d.startsWith('0')) d = d.slice(1);
    if (/^3\d{9}$/.test(d)) return d;
  }
  const local = text.match(/\b03\d{9}\b/);
  if (local) return local[0].slice(1);
  const mSpaced = text.match(/\b03\d{2}[\s-]?\d{7}\b/);
  if (mSpaced) {
    const d = mSpaced[0].replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('03')) return d.slice(1);
  }
  return null;
}

function extractAmount(text: string): number | null {
  const reList = [
    /(?:PKR|Rs\.?|RS\.?)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /(?:paid|payment|fee|amount|charges?|total)\s*:?\s*(?:PKR|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /([\d,]+(?:\.\d{1,2})?)\s*(?:PKR|Rs\.?)\b/gi,
  ];
  const candidates: number[] = [];
  for (const re of reList) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const n = Number(String(m[1]).replace(/,/g, ''));
      if (Number.isFinite(n) && n >= 50 && n <= 500000) candidates.push(n);
    }
  }
  if (!candidates.length) return null;
  return Math.max(...candidates);
}

function extractDate(text: string, refYmd: string): string | null {
  const refY = Number(refYmd.slice(0, 4));
  const refM = Number(refYmd.slice(5, 7));
  const refD = Number(refYmd.slice(8, 10));

  const yFromText = (() => {
    const m = text.match(/\b(20\d{2})\b/);
    return m ? Number(m[1]) : null;
  })();

  const tryYear = (y: number, m: number, d: number): string | null =>
    ymdFromParts(y, m, d);

  const monthDay = (m: number, d: number): string | null => {
    const year = yFromText ?? refY;
    let y = year;
    let cand = tryYear(y, m, d);
    if (!cand) return null;
    if (yFromText == null) {
      const cTime = new Date(`${cand}T12:00:00Z`).getTime();
      const rTime = new Date(`${refYmd}T12:00:00Z`).getTime();
      if (cTime < rTime - 120 * 24 * 3600 * 1000) {
        y += 1;
        cand = tryYear(y, m, d);
      }
    }
    return cand;
  };

  const rxDayMonth = new RegExp(
    `\\b(\\d{1,2})\\s+(${Object.keys(MONTH_WORD).join('|')})\\b`,
    'i',
  );
  const dm = text.match(rxDayMonth);
  if (dm) {
    const d = Number(dm[1]);
    const m = parseMonthToken(dm[2]);
    if (m) return monthDay(m, d);
  }

  const rxMonthDay = new RegExp(
    `\\b(${Object.keys(MONTH_WORD).join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`,
    'i',
  );
  const md = text.match(rxMonthDay);
  if (md) {
    const m = parseMonthToken(md[1]);
    const d = Number(md[2]);
    if (m) return monthDay(m, d);
  }

  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) {
    return tryYear(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const dmy = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (dmy) {
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    return tryYear(y, Number(dmy[2]), Number(dmy[1]));
  }

  void refM;
  void refD;
  return null;
}

const RANGE_SEP = String.raw`(?:\s*[-–—]\s*|\s+(?:to|until|till)\s+)`;

function extractTimeRange(text: string): { start: string; end: string } | null {
  const t = text.replace(/\u2013|\u2014/g, '-');

  const patterns: RegExp[] = [
    new RegExp(
      `(\\d{1,2}):(\\d{2})\\s*(AM|PM)${RANGE_SEP}(\\d{1,2}):(\\d{2})\\s*(AM|PM)`,
      'i',
    ),
    new RegExp(
      `(\\d{1,2})\\s*(AM|PM)${RANGE_SEP}(\\d{1,2}):(\\d{2})\\s*(AM|PM)`,
      'i',
    ),
    new RegExp(`(\\d{1,2})\\s*(AM|PM)${RANGE_SEP}(\\d{1,2})\\s*(AM|PM)`, 'i'),
    new RegExp(`(\\d{2}):(\\d{2})${RANGE_SEP}(\\d{2}):(\\d{2})`),
  ];

  for (const re of patterns) {
    const m = t.match(re);
    if (!m) continue;
    if (re.source.includes('AM')) {
      if (m.length >= 7) {
        const a = parse12hToMinutes(Number(m[1]), Number(m[2]), m[3]);
        const b = parse12hToMinutes(Number(m[4]), Number(m[5]), m[6]);
        if (a != null && b != null && b > a) {
          return {
            start: minutesToHHmm(a),
            end: minutesToHHmm(b),
          };
        }
      }
      if (m.length >= 6 && !m[2].match(/\d/)) {
        const a = parse12hToMinutes(Number(m[1]), 0, m[2]);
        const b = parse12hToMinutes(Number(m[3]), Number(m[4]), m[5]);
        if (a != null && b != null && b > a) {
          return {
            start: minutesToHHmm(a),
            end: minutesToHHmm(b),
          };
        }
      }
    } else {
      const h1 = Number(m[1]);
      const min1 = Number(m[2]);
      const h2 = Number(m[3]);
      const min2 = Number(m[4]);
      if (
        h1 >= 0 &&
        h1 <= 23 &&
        h2 >= 0 &&
        h2 <= 23 &&
        min1 >= 0 &&
        min1 <= 59 &&
        min2 >= 0 &&
        min2 <= 59
      ) {
        const a = h1 * 60 + min1;
        const b = h2 * 60 + min2;
        if (b > a) {
          return { start: minutesToHHmm(a), end: minutesToHHmm(b) };
        }
      }
    }
  }
  return null;
}

function extractCourtPhrase(text: string): { phrase: string | null; num: number | null } {
  const m1 = text.match(/\b(?:padel\s+)?court\s*(\d+)\b/i);
  if (m1) {
    return {
      phrase: normalizeSpaces(m1[0].replace(/\s+/g, ' ')),
      num: Number(m1[1]),
    };
  }
  const m2 = text.match(/\b(?:padel|futsal|cricket|turf)\s+court\s*(\d+)\b/i);
  if (m2) {
    return { phrase: normalizeSpaces(m2[0]), num: Number(m2[1]) };
  }
  return { phrase: null, num: null };
}

const STOP_NAME = new Set(
  [
    'padel',
    'court',
    'booking',
    'reserved',
    'confirmed',
    'customer',
    'contact',
    'phone',
    'amount',
    'paid',
    'may',
    'june',
    'session',
    'slot',
    'active',
    'sports',
    'facility',
    'memo',
    'invoice',
    'receipt',
    'log',
    'entry',
    'note',
    'token',
  ].map((s) => s.toLowerCase()),
);

function scoreNameCandidate(s: string): number {
  const w = s.split(/\s+/).filter(Boolean);
  if (w.length < 2 || w.length > 5) return -1;
  let score = w.length * 3;
  for (const x of w) {
    if (/^\d+$/.test(x)) return -1;
    if (STOP_NAME.has(x.toLowerCase())) score -= 5;
    if (/^[A-Z][a-z]+$/.test(x)) score += 1;
  }
  return score;
}

function extractCustomerName(text: string, phone: string | null): string | null {
  let t = text.replace(/\u2013|\u2014/g, '-');
  if (phone) {
    t = t.replace(new RegExp(phone.replace(/(\d)/g, '[\\s-]?$1'), 'g'), ' ');
  }

  const candidates: string[] = [];

  const pipe = t.match(
    /^\s*([^|/]{3,80}?)\s*[|/]\s*(?:\+?92|0)?3\d/i,
  );
  if (pipe?.[1]) candidates.push(pipe[1].trim());

  const bookingFor = t.match(
    /\b(?:for|under|by|to)\s+([A-Z][^|/\n]{2,60}?)(?:\s+(?:booked|has|on|at|from|between|,|\|))/i,
  );
  if (bookingFor?.[1]) candidates.push(bookingFor[1].trim());

  const bookedLead = t.match(
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4})\s+(?:booked|reserved|secured|confirmed|officially)/im,
  );
  if (bookedLead?.[1]) candidates.push(bookedLead[1].trim());

  const nameColon = t.match(/\bName\s*:\s*([^|/\n]+)/i);
  if (nameColon?.[1]) candidates.push(nameColon[1].trim());

  const customer = t.match(/\bCustomer\s+([A-Z][^|(/\n]{2,60})/i);
  if (customer?.[1]) candidates.push(customer[1].trim());

  let best: string | null = null;
  let bestScore = 0;
  for (const raw of candidates) {
    const cleaned = normalizeSpaces(
      raw.replace(/^(?:the|a|an)\s+/i, '').replace(/[,]+$/g, ''),
    );
    const sc = scoreNameCandidate(cleaned);
    if (sc > bestScore) {
      bestScore = sc;
      best = cleaned;
    }
  }
  return best;
}

function inferSport(text: string, courtPhrase: string | null): FreeTextBookingParseResult['inferredSport'] {
  const low = text.toLowerCase();
  if (courtPhrase?.toLowerCase().includes('padel') || /\bpadel\b/i.test(text))
    return 'padel';
  if (/\bfutsal\b/i.test(low)) return 'futsal';
  if (/\bcricket\b/i.test(low)) return 'cricket';
  if (/\btable[\s-]?tennis\b/i.test(low)) return 'table-tennis';
  if (/\bcourt\s*\d+/i.test(text) && /\bpadel\b/i.test(low)) return 'padel';
  if (/\bcourt\s*\d+/i.test(text)) return 'padel';
  return null;
}

/**
 * @param message Raw message
 * @param referenceDateYmd Calendar day used when the message omits a year (`YYYY-MM-DD`)
 */
export function parseFreeTextBookingMessage(
  message: string,
  referenceDateYmd: string,
): FreeTextBookingParseResult {
  const warnings: string[] = [];
  const text = (message ?? '').trim();
  if (!text) {
    return {
      customerName: null,
      phoneDigits: null,
      bookingDate: null,
      startTime: null,
      endTime: null,
      amount: null,
      courtPhrase: null,
      courtNumber: null,
      inferredSport: null,
      warnings: ['Empty message'],
    };
  }

  const refYmd =
    /^\d{4}-\d{2}-\d{2}$/.test(referenceDateYmd) === true
      ? referenceDateYmd
      : new Date().toISOString().slice(0, 10);

  const phoneDigits = extractPhone(text);
  if (!phoneDigits) warnings.push('Could not find a Pakistan mobile number (03XX…).');

  const amount = extractAmount(text);
  if (amount == null) warnings.push('Could not find an amount (Rs / PKR).');

  const bookingDate = extractDate(text, refYmd);
  if (!bookingDate) warnings.push('Could not parse booking date.');

  const tr = extractTimeRange(text);
  if (!tr) warnings.push('Could not parse start and end time.');
  const startTime = tr?.start ?? null;
  const endTime = tr?.end ?? null;

  const { phrase: courtPhrase, num: courtNumber } = extractCourtPhrase(text);
  if (!courtPhrase) warnings.push('Could not identify court (e.g. Padel Court 1).');

  const inferredSport = inferSport(text, courtPhrase);
  if (!inferredSport) warnings.push('Could not infer sport type from text.');

  const customerName = extractCustomerName(text, phoneDigits);

  return {
    customerName,
    phoneDigits,
    bookingDate,
    startTime,
    endTime,
    amount,
    courtPhrase,
    courtNumber,
    inferredSport,
    warnings,
  };
}
