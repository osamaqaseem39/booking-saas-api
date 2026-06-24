import { Injectable, Logger } from '@nestjs/common';
import { BookingsService } from '../bookings/bookings.service';
import type { BookingSportType } from '../bookings/types/booking.types';
import type { WhatsappChannel } from './entities/whatsapp-channel.entity';
import type {
  WhatsappConversation,
  WhatsappConversationState,
  WhatsappSlotOption,
} from './entities/whatsapp-conversation.entity';
import { WhatsappBookingService } from './whatsapp-booking.service';
import { WhatsappConversationsService } from './whatsapp-conversations.service';
import { WhatsappMessagesService } from './whatsapp-messages.service';
import { WhatsappQaService } from './whatsapp-qa.service';
import { WhatsappSendService } from './whatsapp-send.service';

const SPORTS: Array<{ key: BookingSportType; label: string; n: number }> = [
  { key: 'padel', label: 'Padel', n: 1 },
  { key: 'futsal', label: 'Futsal', n: 2 },
  { key: 'cricket', label: 'Cricket', n: 3 },
  { key: 'table-tennis', label: 'Table tennis', n: 4 },
];

function norm(text: string): string {
  return text.trim().toLowerCase();
}

function isAffirmative(text: string): boolean {
  return ['yes', 'y', 'confirm', 'ok', 'ha', 'han', 'ji', 'theek', 'done'].includes(
    norm(text),
  );
}

function isMenuCommand(text: string): boolean {
  const t = norm(text);
  return ['menu', 'cancel', 'stop', 'reset', 'start'].includes(t);
}

function parseSportChoice(text: string): BookingSportType | null {
  const t = norm(text);
  const byNum = SPORTS.find((s) => t === String(s.n));
  if (byNum) return byNum.key;
  if (t.includes('padel')) return 'padel';
  if (t.includes('futsal')) return 'futsal';
  if (t.includes('cricket')) return 'cricket';
  if (t.includes('table') || t.includes('tt')) return 'table-tennis';
  return null;
}

function karachiToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function parseDateChoice(text: string, ref: string): string | null {
  const t = norm(text);
  if (t === 'today' || t === 'aaj') return ref;
  if (t === 'tomorrow' || t === 'kal') return addDaysYmd(ref, 1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const dm = t.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{4}))?$/);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]);
    const year = dm[3] ? Number(dm[3]) : Number(ref.slice(0, 4));
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return null;
}

function menuText(greeting?: string | null): string {
  const intro =
    greeting?.trim() ||
    'Welcome! I can help you book a court.';
  const lines = SPORTS.map((s) => `${s.n}) ${s.label}`).join('\n');
  return `${intro}\n\nReply with a sport number or name:\n${lines}\n\nOr send your booking in one message (name, date, time, court).`;
}

function buildSlotOptions(
  facilities: Array<{
    kind: string;
    courtId: string;
    name: string;
    price?: number;
    slots: Array<{ startTime: string; endTime: string; availability: string }>;
  }>,
  max = 10,
): WhatsappSlotOption[] {
  const out: WhatsappSlotOption[] = [];
  for (const f of facilities) {
    for (const s of f.slots) {
      if (s.availability !== 'available') continue;
      out.push({
        courtKind: f.kind,
        courtId: f.courtId,
        courtName: f.name,
        startTime: s.startTime,
        endTime: s.endTime,
        price: Number(f.price ?? 0),
      });
      if (out.length >= max) return out;
    }
  }
  return out;
}

@Injectable()
export class WhatsappBotService {
  private readonly logger = new Logger(WhatsappBotService.name);

  constructor(
    private readonly conversations: WhatsappConversationsService,
    private readonly messages: WhatsappMessagesService,
    private readonly bookings: BookingsService,
    private readonly bookingFlow: WhatsappBookingService,
    private readonly qa: WhatsappQaService,
    private readonly send: WhatsappSendService,
  ) {}

  private resolveLocationId(channel: WhatsappChannel): string | null {
    return channel.locationId ?? channel.defaultLocationId ?? null;
  }

  async replyText(
    channel: WhatsappChannel,
    conv: WhatsappConversation,
    toWaId: string,
    body: string,
  ): Promise<void> {
    const outbound = await this.messages.appendOutbound({
      conversation: conv,
      channel,
      body,
      deliveryStatus: 'pending',
    });
    try {
      await this.send.sendForChannel(channel, toWaId, body);
      await this.messages.markSent(outbound.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.messages.markFailed(outbound.id, msg);
      this.logger.error(`WhatsApp reply failed to=${toWaId}: ${msg}`);
    }
  }

  async handleInbound(
    channel: WhatsappChannel,
    conv: WhatsappConversation,
    from: string,
    text: string,
  ): Promise<void> {
    const locationId = this.resolveLocationId(channel);
    if (!locationId) {
      await this.replyText(
        channel,
        conv,
        from,
        'This WhatsApp number is not linked to a venue yet. Please contact the facility.',
      );
      return;
    }

    const ref = karachiToday();
    const trimmed = text.trim();
    if (trimmed.length >= 24) {
      const oneShot = await this.bookingFlow.tryOneShotBooking({
        tenantId: channel.tenantId,
        locationId,
        waId: from,
        message: trimmed,
        referenceDateYmd: ref,
      });
      if (oneShot) {
        await this.conversations.reset(conv);
        await this.replyText(channel, conv, from, oneShot.reply);
        return;
      }
    }

    if (isMenuCommand(trimmed)) {
      await this.conversations.reset(conv);
      await this.replyText(channel, conv, from, menuText(channel.greetingMessage));
      return;
    }

    if (this.qa.shouldAnswerAsFaq(trimmed, conv.step)) {
      const answer = await this.qa.answerQuery({
        locationId,
        question: trimmed,
        greeting: channel.greetingMessage,
      });
      await this.replyText(channel, conv, from, answer);
      return;
    }

    const state = { ...(conv.state ?? {}) };
    let step = conv.step;
    let replyText = '';

    if (step === 'menu' || ['hi', 'hello', 'salam', 'book', 'booking'].includes(norm(trimmed))) {
      step = 'pick_sport';
      replyText = menuText(channel.greetingMessage);
    } else if (step === 'pick_sport') {
      const sport = parseSportChoice(trimmed);
      if (!sport) {
        replyText = 'Pick a sport:\n' + SPORTS.map((s) => `${s.n}) ${s.label}`).join('\n');
      } else {
        state.sport = sport;
        step = 'pick_date';
        replyText = `*${SPORTS.find((s) => s.key === sport)?.label}*\nWhen do you want to play?\nReply *today*, *tomorrow*, or a date (YYYY-MM-DD).`;
      }
    } else if (step === 'pick_date') {
      const date = parseDateChoice(trimmed, ref);
      if (!date || date < ref) {
        replyText = 'Send a valid date: *today*, *tomorrow*, or YYYY-MM-DD (not in the past).';
      } else {
        state.bookingDate = date;
        const sport = state.sport as BookingSportType;
        const avail = await this.bookings.getLocationFacilitiesAvailableSlots({
          locationId,
          date,
          courtType: sport,
        });
        const options = buildSlotOptions(avail.facilities);
        if (!options.length) {
          replyText = `No free slots on ${date}. Try another date or reply *menu*.`;
          step = 'pick_date';
        } else {
          state.slotOptions = options;
          step = 'pick_slot';
          replyText =
            `Available on *${date}*:\n` +
            options
              .map(
                (o, i) =>
                  `${i + 1}) ${o.courtName} ${o.startTime}–${o.endTime}${o.price ? ` · Rs.${o.price}` : ''}`,
              )
              .join('\n') +
            '\n\nReply with the slot number.';
        }
      }
    } else if (step === 'pick_slot') {
      const n = Number(trimmed.replace(/\D/g, ''));
      const options = state.slotOptions ?? [];
      const pick = options[n - 1];
      if (!pick) {
        replyText = `Reply 1–${options.length} to choose a slot, or *menu* to start over.`;
      } else {
        state.selectedSlot = pick;
        step = 'confirm';
        replyText = [
          'Confirm booking:',
          `${pick.courtName}`,
          `${state.bookingDate} · ${pick.startTime}–${pick.endTime}`,
          pick.price > 0 ? `Rs. ${pick.price.toLocaleString()}` : '',
          'Reply *YES* to confirm or *menu* to cancel.',
        ]
          .filter(Boolean)
          .join('\n');
      }
    } else if (step === 'confirm') {
      if (!isAffirmative(trimmed)) {
        replyText = 'Reply *YES* to confirm or *menu* to cancel.';
      } else if (!state.selectedSlot || !state.bookingDate || !state.sport) {
        await this.conversations.reset(conv);
        replyText = menuText(channel.greetingMessage);
        step = 'pick_sport';
      } else if (!state.customerName?.trim()) {
        step = 'await_name';
        replyText = 'What name should we put on the booking?';
      } else {
        replyText = await this.finalizeBooking(channel, from, state);
        step = 'menu';
        Object.assign(state, {
          sport: undefined,
          bookingDate: undefined,
          slotOptions: undefined,
          selectedSlot: undefined,
          customerName: undefined,
        });
      }
    } else if (step === 'await_name') {
      const name = trimmed.slice(0, 120);
      if (name.length < 2) {
        replyText = 'Please send your name (at least 2 characters).';
      } else {
        state.customerName = name;
        replyText = await this.finalizeBooking(channel, from, state);
        step = 'menu';
        Object.assign(state, {
          sport: undefined,
          bookingDate: undefined,
          slotOptions: undefined,
          selectedSlot: undefined,
          customerName: undefined,
        });
      }
    } else {
      replyText = menuText(channel.greetingMessage);
      step = 'pick_sport';
    }

    await this.conversations.saveStep(conv, step, state);
    if (replyText) await this.replyText(channel, conv, from, replyText);
  }

  private async finalizeBooking(
    channel: WhatsappChannel,
    from: string,
    state: WhatsappConversationState,
  ): Promise<string> {
    try {
      const slot = state.selectedSlot!;
      const user = await this.bookingFlow.ensureCustomerUser({
        waId: from,
        fullName: state.customerName!.trim(),
      });
      const { reference } = await this.bookingFlow.createFromSlot({
        tenantId: channel.tenantId,
        userId: user.id,
        sportType: state.sport as BookingSportType,
        bookingDate: state.bookingDate!,
        slot,
        customerName: state.customerName!.trim(),
      });
      return [
        `Booking confirmed! Ref *${reference}*`,
        `${slot.courtName}`,
        `${state.bookingDate} · ${slot.startTime}–${slot.endTime}`,
        slot.price > 0 ? `Rs. ${slot.price.toLocaleString()}` : '',
        'Pay at the venue. Reply *menu* for another booking.',
      ]
        .filter(Boolean)
        .join('\n');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not create booking';
      this.logger.warn(`WhatsApp booking finalize failed: ${msg}`);
      return `Sorry, that slot could not be booked (${msg}). Reply *menu* to try again.`;
    }
  }
}
