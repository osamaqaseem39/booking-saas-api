import { Injectable, Logger } from '@nestjs/common';
import { BusinessesService } from '../businesses/businesses.service';
import {
  isGeminiBookingParseConfigured,
  geminiBookingModelId,
} from '../bookings/utils/gemini-free-text-parse.util';
import {
  isOpenAiBookingParseConfigured,
  openAiBookingModelId,
} from '../bookings/utils/openai-free-text-parse.util';

type VenueContext = {
  businessName: string;
  locationName: string;
  address: string;
  city: string;
  phone: string;
  details: string;
  sports: string[];
  facilities: Array<{ name: string; pricePerSlot: number; sports?: string[] }>;
  workingHours: string;
  currency: string;
  greeting?: string | null;
};

function norm(text: string): string {
  return text.trim().toLowerCase();
}

function formatWorkingHours(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const lines: string[] = [];
  for (const [day, val] of Object.entries(raw as Record<string, unknown>)) {
    if (val == null) continue;
    if (typeof val === 'string' && val.trim()) {
      lines.push(`${day}: ${val.trim()}`);
      continue;
    }
    if (typeof val === 'object' && val !== null) {
      const o = val as { open?: string; close?: string; closed?: boolean };
      if (o.closed) {
        lines.push(`${day}: closed`);
      } else if (o.open && o.close) {
        lines.push(`${day}: ${o.open}–${o.close}`);
      }
    }
  }
  return lines.length ? lines.join('\n') : null;
}

function looksLikeFaqQuery(text: string): boolean {
  const t = norm(text);
  if (t.length < 3) return false;
  if (t.includes('?')) return true;
  return /^(what|where|when|how|why|which|who|do you|are you|can i|is there|kitna|kahan|kab|kya|kaise|timing|price|rate|address|location|hour|open|close|contact|phone|parking|wifi|amenit)/i.test(
    t,
  );
}

function looksLikeBookingIntent(text: string): boolean {
  const t = norm(text);
  if (['book', 'booking', 'slot', 'reserve', 'court'].some((w) => t.includes(w))) return true;
  if (/\b(padel|futsal|cricket|table.?tennis|tt)\b/.test(t)) return true;
  if (/\b(today|tomorrow|aaj|kal)\b/.test(t)) return true;
  if (/\d{1,2}:\d{2}/.test(t) || /\d{4}-\d{2}-\d{2}/.test(t)) return true;
  if (t.length >= 24 && /\d/.test(t)) return true;
  return false;
}

@Injectable()
export class WhatsappQaService {
  private readonly logger = new Logger(WhatsappQaService.name);

  constructor(private readonly businesses: BusinessesService) {}

  shouldAnswerAsFaq(text: string, step: string): boolean {
    const trimmed = text.trim();
    if (!trimmed || isMenuLike(trimmed)) return false;
    if (looksLikeBookingIntent(trimmed)) return false;
    if (looksLikeFaqQuery(trimmed)) return true;
    if (step === 'menu' && !isGreeting(trimmed)) {
      return trimmed.length >= 8 && !looksLikeBookingIntent(trimmed);
    }
    if (step === 'pick_sport' && !parseSportHint(trimmed)) {
      return looksLikeFaqQuery(trimmed) || trimmed.length >= 12;
    }
    return false;
  }

  async answerQuery(input: {
    locationId: string;
    question: string;
    greeting?: string | null;
  }): Promise<string> {
    const venue = await this.loadVenueContext(input.locationId, input.greeting);
    const rule = this.ruleBasedAnswer(input.question, venue);
    if (rule) return rule;

    const llm = await this.llmAnswer(input.question, venue);
    if (llm) return llm;

    return [
      `Thanks for your message! I'm the assistant for *${venue.locationName}*.`,
      'I can help you *book a court* — reply *menu* to see sports and slots.',
      venue.phone ? `Or call us: ${venue.phone}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private async loadVenueContext(
    locationId: string,
    greeting?: string | null,
  ): Promise<VenueContext> {
    const v = await this.businesses.getVenueDetailsPublic(locationId);
    const wh = formatWorkingHours((v as { workingHours?: unknown }).workingHours);
    return {
      businessName: v.clubDetails?.businessName ?? v.name,
      locationName: v.name,
      address: [v.address, v.city, v.area].filter(Boolean).join(', '),
      city: v.city ?? '',
      phone: (v as { phone?: string }).phone ?? '',
      details: v.clubDetails?.description ?? '',
      sports: v.clubDetails?.sportsOffered ?? [],
      facilities: (v.facilityList ?? []).map((f) => ({
        name: f.name,
        pricePerSlot: Number(f.pricePerSlot ?? 0),
        sports: f.supportedSports,
      })),
      workingHours: wh ?? '',
      currency: v.currency ?? 'PKR',
      greeting,
    };
  }

  private ruleBasedAnswer(query: string, venue: VenueContext): string | null {
    const t = norm(query);
    const footer = '\n\nReply *menu* to book a court.';

    if (/(hour|timing|timings|open|close|kab\s*khul|kitne\s*baje)/.test(t)) {
      if (venue.workingHours) {
        return `*Opening hours*\n${venue.workingHours}${footer}`;
      }
      return `Please contact us for opening hours.${venue.phone ? ` Phone: ${venue.phone}` : ''}${footer}`;
    }

    if (/(address|location|where|kahan|map|direction)/.test(t)) {
      if (venue.address) {
        return `*${venue.locationName}*\n${venue.address}${footer}`;
      }
      return `Please contact us for directions.${venue.phone ? ` Phone: ${venue.phone}` : ''}${footer}`;
    }

    if (/(price|rate|cost|charges|kitna|fees|tariff)/.test(t)) {
      const priced = venue.facilities.filter((f) => f.pricePerSlot > 0);
      if (priced.length) {
        const lines = priced
          .slice(0, 8)
          .map((f) => `• ${f.name}: ${venue.currency} ${f.pricePerSlot.toLocaleString()}/slot`);
        return `*Rates*\n${lines.join('\n')}${footer}`;
      }
      return `Rates vary by court and time. Reply *menu* to see live availability and prices.${footer}`;
    }

    if (/(phone|contact|call|number|whatsapp)/.test(t)) {
      if (venue.phone) return `Call us: *${venue.phone}*${footer}`;
      return `Reply *menu* to book, or visit us at ${venue.locationName}.${footer}`;
    }

    if (/(sport|court|facilit|kya\s*khel|what do you offer)/.test(t)) {
      const sports = venue.sports.length
        ? venue.sports.map((s) => s.replace(/-/g, ' ')).join(', ')
        : 'courts';
      return `We offer: *${sports}*. Reply *menu* to book.${footer}`;
    }

    if (isGreeting(t)) {
      const intro = venue.greeting?.trim() || `Welcome to *${venue.locationName}*!`;
      return `${intro}\n\nAsk about hours, location, or rates — or reply *menu* to book.`;
    }

    return null;
  }

  private async llmAnswer(question: string, venue: VenueContext): Promise<string | null> {
    if (isOpenAiBookingParseConfigured()) {
      return this.openAiAnswer(question, venue);
    }
    if (isGeminiBookingParseConfigured()) {
      return this.geminiAnswer(question, venue);
    }
    return null;
  }

  private buildLlmPrompt(question: string, venue: VenueContext): string {
    const ctx = {
      business: venue.businessName,
      location: venue.locationName,
      address: venue.address,
      phone: venue.phone,
      sports: venue.sports,
      facilities: venue.facilities.slice(0, 12),
      workingHours: venue.workingHours,
      details: venue.details?.slice(0, 800),
      currency: venue.currency,
    };
    return `You are a friendly WhatsApp assistant for a sports facility in Pakistan.
Answer ONLY from the venue facts below. If unsure, say to reply *menu* to book or call the venue.
Keep replies under 400 characters, plain text (WhatsApp). Use *bold* sparingly. No markdown links.
Do not invent prices, hours, or policies not in the facts.

VENUE_FACTS:
${JSON.stringify(ctx)}

CUSTOMER_QUESTION:
${question.trim()}`;
  }

  private async openAiAnswer(question: string, venue: VenueContext): Promise<string | null> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return null;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 25_000);
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: openAiBookingModelId(),
          temperature: 0.3,
          max_tokens: 350,
          messages: [
            {
              role: 'system',
              content:
                'Concise WhatsApp replies for a sports venue. Only use provided facts.',
            },
            { role: 'user', content: this.buildLlmPrompt(question, venue) },
          ],
        }),
        signal: ac.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      return text || null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`OpenAI QA failed: ${msg}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async geminiAnswer(question: string, venue: VenueContext): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return null;
    const model = geminiBookingModelId();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 22_000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: this.buildLlmPrompt(question, venue) }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 350 },
        }),
        signal: ac.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return text || null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Gemini QA failed: ${msg}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

function isMenuLike(text: string): boolean {
  return ['menu', 'cancel', 'stop', 'reset', 'start'].includes(norm(text));
}

function isGreeting(text: string): boolean {
  const t = norm(text);
  return ['hi', 'hello', 'salam', 'assalam', 'hey', 'aoa'].some(
    (w) => t === w || t.startsWith(`${w} `),
  );
}

function parseSportHint(text: string): boolean {
  const t = norm(text);
  if (/^[1-4]$/.test(t)) return true;
  return /\b(padel|futsal|cricket|table|tt)\b/.test(t);
}
