import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { WhatsappChannel } from './entities/whatsapp-channel.entity';
import { normalizeWaId } from './utils/whatsapp-wa-id.util';
import { WhatsappBotService } from './whatsapp-bot.service';
import { WhatsappChannelsService } from './whatsapp-channels.service';
import { WhatsappInboundDedupService } from './whatsapp-inbound-dedup.service';
import { WhatsappSendService } from './whatsapp-send.service';
import type { WaInboundMessage } from './whatsapp-webhook.service';

@Injectable()
export class WhatsappOpenwaWebhookService {
  private readonly logger = new Logger(WhatsappOpenwaWebhookService.name);

  constructor(
    private readonly channels: WhatsappChannelsService,
    private readonly bot: WhatsappBotService,
    private readonly dedup: WhatsappInboundDedupService,
    private readonly send: WhatsappSendService,
  ) {}

  assertValidSignature(payload: unknown, signature?: string): void {
    const secret = process.env.OPENWA_WEBHOOK_SECRET?.trim();
    if (!secret) return;
    if (!signature?.startsWith('sha256=') || payload == null) {
      throw new Error('Missing OpenWA webhook signature');
    }
    const expected =
      'sha256=' +
      createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
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

    if (msg.messageId) {
      const acquired = await this.dedup.tryAcquire(msg.messageId);
      if (!acquired) return;
    }

    try {
      if (!channel.botEnabled) return;

      if (msg.kind === 'unsupported') {
        try {
          await this.send.sendForChannel(
            channel,
            msg.from,
            'Please send a text message to book a court. Reply *menu* to see options.',
          );
        } catch (e) {
          const detail = e instanceof Error ? e.message : String(e);
          this.logger.error(`OpenWA unsupported-type reply failed: ${detail}`);
        }
        return;
      }

      await this.bot.handleInbound(channel, msg.from, msg.text!);
    } catch (e) {
      if (msg.messageId) await this.dedup.release(msg.messageId);
      throw e;
    }
  }
}
