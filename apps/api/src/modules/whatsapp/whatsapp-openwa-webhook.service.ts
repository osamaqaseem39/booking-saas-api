import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { WhatsappChannel } from './entities/whatsapp-channel.entity';
import { normalizeWaId } from './utils/whatsapp-wa-id.util';
import { WhatsappBotService } from './whatsapp-bot.service';
import { WhatsappChannelsService } from './whatsapp-channels.service';
import { WhatsappConversationsService } from './whatsapp-conversations.service';
import { WhatsappInboundDedupService } from './whatsapp-inbound-dedup.service';
import { WhatsappMessagesService } from './whatsapp-messages.service';
import { WhatsappSendService } from './whatsapp-send.service';
import type { WaInboundMessage } from './whatsapp-webhook.service';

function canonicalWebhookJson(payload: Record<string, unknown>): string {
  const ordered: Record<string, unknown> = {};
  for (const key of [
    'event',
    'timestamp',
    'sessionId',
    'idempotencyKey',
    'deliveryId',
    'data',
  ]) {
    if (key in payload) ordered[key] = payload[key];
  }
  return JSON.stringify(ordered);
}

@Injectable()
export class WhatsappOpenwaWebhookService {
  private readonly logger = new Logger(WhatsappOpenwaWebhookService.name);

  constructor(
    private readonly channels: WhatsappChannelsService,
    private readonly conversations: WhatsappConversationsService,
    private readonly messages: WhatsappMessagesService,
    private readonly bot: WhatsappBotService,
    private readonly dedup: WhatsappInboundDedupService,
    private readonly send: WhatsappSendService,
  ) {}

  assertValidSignature(
    payload: unknown,
    signature?: string,
    rawBody?: Buffer | string,
  ): void {
    const secret = process.env.OPENWA_WEBHOOK_SECRET?.trim();
    if (!secret) return;
    if (!signature?.startsWith('sha256=')) {
      throw new Error('Missing OpenWA webhook signature');
    }
    const body =
      rawBody != null
        ? Buffer.isBuffer(rawBody)
          ? rawBody
          : Buffer.from(rawBody, 'utf8')
        : payload != null && typeof payload === 'object'
          ? Buffer.from(
              canonicalWebhookJson(payload as Record<string, unknown>),
              'utf8',
            )
          : null;
    if (body == null) {
      throw new Error('Missing OpenWA webhook body');
    }
    const expected =
      'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Invalid OpenWA webhook signature');
    }
  }

  extractInboundMessage(payload: unknown): WaInboundMessage | null {
    const root = payload as {
      event?: string;
      sessionId?: string;
      idempotencyKey?: string;
      data?: {
        id?: string;
        messageId?: string;
        from?: string;
        chatId?: string;
        body?: string;
        type?: string;
        isGroup?: boolean;
      };
    };
    if (root.event !== 'message.received') return null;
    const sessionId = root.sessionId?.trim();
    const data = root.data;
    if (!sessionId || !data || data.isGroup) return null;
    const fromRaw = data.from?.trim() || data.chatId?.trim();
    if (!fromRaw) return null;
    const messageId =
      data.id?.trim() ||
      data.messageId?.trim() ||
      root.idempotencyKey?.trim() ||
      '';
    const type = data.type?.trim() || 'chat';
    const from = normalizeWaId(fromRaw);
    if ((type === 'chat' || type === 'text') && data.body?.trim()) {
      return {
        phoneNumberId: sessionId,
        from,
        messageId,
        kind: 'text',
        text: data.body.trim(),
      };
    }
    if (messageId) {
      return {
        phoneNumberId: sessionId,
        from,
        messageId,
        kind: 'unsupported',
      };
    }
    return null;
  }

  async handlePayload(payload: unknown): Promise<void> {
    const msg = this.extractInboundMessage(payload);
    if (!msg) return;
    await this.processInbound(msg);
  }

  async processInbound(msg: WaInboundMessage): Promise<void> {
    const channel = await this.channels.findByOpenWaSessionId(msg.phoneNumberId);
    if (!channel) {
      this.logger.warn(`No OpenWA channel for sessionId=${msg.phoneNumberId}`);
      return;
    }
    await this.channels.touchWebhook(channel.id);

    const conv = await this.conversations.getOrCreate({
      channelId: channel.id,
      tenantId: channel.tenantId,
      customerWaId: msg.from,
    });

    if (msg.kind === 'text' && msg.text) {
      await this.messages.appendInbound({
        conversation: conv,
        channel,
        body: msg.text,
        externalMessageId: msg.messageId || undefined,
      });
    }

    if (msg.messageId) {
      const acquired = await this.dedup.tryAcquire(msg.messageId);
      if (!acquired) return;
    }

    try {
      if (!channel.botEnabled) return;

      if (msg.kind === 'unsupported') {
        await this.bot.replyText(
          channel,
          conv,
          msg.from,
          'Please send a text message to book a court. Reply *menu* to see options.',
        );
        return;
      }

      await this.bot.handleInbound(channel, conv, msg.from, msg.text!);
    } catch (e) {
      if (msg.messageId) await this.dedup.release(msg.messageId);
      const detail = e instanceof Error ? e.message : String(e);
      this.logger.error(`OpenWA inbound handler failed: ${detail}`);
    }
  }
}
