import type { FreeTextBookingParseResult } from './parse-free-text-booking.util';

type GeminiRawExtract = {
  customerName?: unknown;
  phoneDigits?: unknown;
  bookingDate?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  amount?: unknown;
  courtPhrase?: unknown;
  courtNumber?: unknown;
  inferredSport?: unknown;
  formattedSummary?: unknown;
};

function stripJsonFence(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  return m ? m[1].trim() : t;
}

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isHhmm(s: string): boolean {
  return /^\d{2}:\d{2}$/.test(s) || s === '24:00';
}

function normalizePhoneDigits(v: unknown): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const d = String(v).replace(/\D/g, '');
  if (!d) return null;
  let x = d;
  if (x.startsWith('92')) x = x.slice(2);
  if (x.startsWith('0')) x = x.slice(1);
  if (/^3\d{9}$/.test(x)) return x;
  return null;
}

function normalizeSport(v: unknown): FreeTextBookingParseResult['inferredSport'] {
  if (typeof v !== 'string') return null;
  const k = v.toLowerCase().trim().replace(/\s+/g, '-');
  if (k === 'padel') return 'padel';
  if (k === 'futsal') return 'futsal';
  if (k === 'cricket') return 'cricket';
  if (k === 'table-tennis' || k === 'tabletennis' || k === 'table_tennis') return 'table-tennis';
  return null;
}

function pickString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length ? s : null;
}

function pickNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null;
  return n;
}

function pickCourtNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 99) return null;
  return n;
}

function parseGeminiPayload(raw: GeminiRawExtract): Partial<FreeTextBookingParseResult> & {
  formattedSummary?: string | null;
} {
  const out: Partial<FreeTextBookingParseResult> & { formattedSummary?: string | null } = {};

  const name = pickString(raw.customerName);
  if (name) out.customerName = name;

  const phone = normalizePhoneDigits(raw.phoneDigits);
  if (phone) out.phoneDigits = phone;

  const bd = pickString(raw.bookingDate);
  if (bd && isYmd(bd)) out.bookingDate = bd;

  const st = pickString(raw.startTime);
  if (st && isHhmm(st)) out.startTime = st;

  const et = pickString(raw.endTime);
  if (et && isHhmm(et)) out.endTime = et;

  const amt = pickNumber(raw.amount);
  if (amt != null) out.amount = amt;

  const cp = pickString(raw.courtPhrase);
  if (cp) out.courtPhrase = cp;

  const cn = pickCourtNumber(raw.courtNumber);
  if (cn != null) out.courtNumber = cn;

  const sp = normalizeSport(raw.inferredSport);
  if (sp) out.inferredSport = sp;

  const fs = pickString(raw.formattedSummary);
  if (fs) out.formattedSummary = fs;

  return out;
}

export function isGeminiBookingParseConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function geminiBookingModelId(): string {
  return (process.env.GEMINI_BOOKING_MODEL ?? 'gemini-2.0-flash').trim() || 'gemini-2.0-flash';
}

/**
 * Calls Google Gemini when `GEMINI_API_KEY` is set. Returns null on failure (caller keeps heuristic only).
 */
export async function fetchGeminiBookingExtract(
  message: string,
  referenceDateYmd: string,
): Promise<(Partial<FreeTextBookingParseResult> & { formattedSummary?: string | null }) | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = geminiBookingModelId();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const instruction = `You extract sports-facility booking details from messy text (WhatsApp, SMS). Venue context: Pakistan (PKR, 03XX mobiles).

REFERENCE_DATE (YYYY-MM-DD — use to resolve dates that omit the year): ${referenceDateYmd}

Return ONLY valid JSON (no markdown fences) with exactly these keys:
{
  "customerName": string | null,
  "phoneDigits": string | null,
  "bookingDate": string | null,
  "startTime": string | null,
  "endTime": string | null,
  "amount": number | null,
  "courtPhrase": string | null,
  "courtNumber": number | null,
  "inferredSport": "padel" | "futsal" | "cricket" | "table-tennis" | null,
  "formattedSummary": string
}

Rules:
- phoneDigits: 10 digits starting with 3 (strip country code 92 and leading 0 from 03XXXXXXXXX). null if absent.
- bookingDate: YYYY-MM-DD only. Prefer explicit dates in the message.
- startTime / endTime: 24h HH:mm. endTime may be "24:00" for end of calendar day. null if unclear.
- amount: PKR as a number, null if not stated.
- courtPhrase: natural phrase, e.g. "Padel Court 1".
- courtNumber: integer court index if clear, else null.
- inferredSport: best guess; null if unknown.
- formattedSummary: 2–4 short sentences for staff (who, when, where, amount).

USER_MESSAGE:
${message.trim()}`;

  const body = {
    contents: [{ parts: [{ text: instruction }] }],
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 22_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini HTTP ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ''}`);
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };
    if (data.error?.message) throw new Error(data.error.message);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string' || !text.trim()) throw new Error('Empty Gemini response');

    const json = JSON.parse(stripJsonFence(text)) as GeminiRawExtract;
    return parseGeminiPayload(json);
  } finally {
    clearTimeout(timer);
  }
}

export function mergeGeminiOverHeuristic(
  heuristic: FreeTextBookingParseResult,
  gemini: Partial<FreeTextBookingParseResult> & { formattedSummary?: string | null },
): FreeTextBookingParseResult {
  const g = <K extends keyof FreeTextBookingParseResult>(key: K): FreeTextBookingParseResult[K] => {
    const gv = gemini[key];
    if (gv !== undefined && gv !== null) {
      if (typeof gv === 'string' && gv.trim() === '') return heuristic[key];
      return gv as FreeTextBookingParseResult[K];
    }
    return heuristic[key];
  };

  return {
    customerName: g('customerName'),
    phoneDigits: g('phoneDigits'),
    bookingDate: g('bookingDate'),
    startTime: g('startTime'),
    endTime: g('endTime'),
    amount: g('amount'),
    courtPhrase: g('courtPhrase'),
    courtNumber: g('courtNumber'),
    inferredSport: g('inferredSport'),
    warnings: [...heuristic.warnings],
    formattedSummary: gemini.formattedSummary ?? heuristic.formattedSummary ?? null,
    parseSource: 'merged',
  };
}
