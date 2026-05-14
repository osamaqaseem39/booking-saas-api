import type { FreeTextBookingParseResult } from './parse-free-text-booking.util';
import {
  type BookingLlmRawExtract,
  parseBookingLlmExtract,
} from './gemini-free-text-parse.util';

function stripJsonFence(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  return m ? m[1].trim() : t;
}

export function isOpenAiBookingParseConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function openAiBookingModelId(): string {
  const raw = process.env.OPENAI_BOOKING_MODEL?.trim();
  return raw && raw.length <= 128 ? raw : 'gpt-4o-mini';
}

function summarizeOpenAiHttpError(status: number, errText: string): string {
  let apiMessage = '';
  try {
    const j = JSON.parse(errText) as { error?: { message?: string } };
    if (typeof j.error?.message === 'string') apiMessage = j.error.message.trim();
  } catch {
    apiMessage = errText.replace(/\s+/g, ' ').trim().slice(0, 200);
  }
  if (status === 401) return 'OpenAI rejected the API key. Check OPENAI_API_KEY.';
  if (status === 429) {
    return 'OpenAI rate limit or quota reached. Retry later or check billing.';
  }
  if (status >= 500) return `OpenAI server error (${status}). Try again later.`;
  if (apiMessage) return `OpenAI error (${status}): ${apiMessage.slice(0, 200)}`;
  return `OpenAI HTTP ${status}`;
}

/**
 * When `OPENAI_API_KEY` is set, used by `parseFreeTextBooking` (preferred over Gemini when both are set).
 */
export async function fetchOpenAiBookingExtract(
  message: string,
  referenceDateYmd: string,
): Promise<(Partial<FreeTextBookingParseResult> & { formattedSummary?: string | null }) | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = openAiBookingModelId();
  const instruction = `You extract sports-facility booking details from messy text (WhatsApp, SMS). Venue context: Pakistan (PKR, 03XX mobiles).

REFERENCE_DATE (YYYY-MM-DD — use to resolve dates that omit the year): ${referenceDateYmd}

Return ONLY valid JSON with exactly these keys (no markdown fences):
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
- courtPhrase: natural phrase, e.g. "Padel Court 1", "Futsal Court 2", "Cricket Turf A".
- courtNumber: integer court index if clear, else null.
- inferredSport: best guess from wording — padel, futsal, cricket (turf/nets), or table-tennis; prefer futsal vs cricket when the message distinguishes them. null if unknown.
- formattedSummary: 2–4 short sentences for staff (who, when, where, amount).

USER_MESSAGE:
${message.trim()}`;

  const body = {
    model,
    temperature: 0.15,
    max_tokens: 1024,
    response_format: { type: 'json_object' as const },
    messages: [
      {
        role: 'system' as const,
        content:
          'You output only compact JSON objects for booking extraction. No prose outside JSON.',
      },
      { role: 'user' as const, content: instruction },
    ],
  };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 45_000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(summarizeOpenAiHttpError(res.status, errText));
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (data.error?.message) throw new Error(data.error.message);
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new Error('Empty OpenAI response');
    const json = JSON.parse(stripJsonFence(text)) as BookingLlmRawExtract;
    return parseBookingLlmExtract(json);
  } finally {
    clearTimeout(timer);
  }
}
