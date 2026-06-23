import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { WhatsappBotService } from './whatsapp-bot.service';
import { WhatsappChannelsService } from './whatsapp-channels.service';
import { WhatsappConversationsService } from './whatsapp-conversations.service';
import { WhatsappInboundDedupService } from './whatsapp-inbound-dedup.service';
import { WhatsappMessagesService } from './whatsapp-messages.service';
import { WhatsappSendService } from './whatsapp-send.service';

export type WaInboundMessage = {
  phoneNumberId: string;
  from: string;
  messageId: string;
  kind: 'text' | 'unsupported';
  text?: string;
};

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  constructor(
    private readonly channels: WhatsappChannelsService,
    private readonly conversations: WhatsappConversationsService,
    private readonly messages: WhatsappMessagesService,
    private readonly bot: WhatsappBotService,
    private readonly dedup: WhatsappInboundDedupService,
    private readonly send: WhatsappSendService,
  ) {}

  verifySubscribe(query: Record<string, string | undefined>): string | null {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
    if (mode === 'subscribe' && expected && token === expected && challenge) {
      return challenge;
    }
    return null;
  }

  assertValidSignature(rawBody: Buffer | string | undefined, signature?: string): void {
    const secret = process.env.WHATSAPP_APP_SECRET?.trim();
    if (!secret) return;
    if (!signature?.startsWith('sha256=') || rawBody == null) {
      throw new Error('Missing WhatsApp webhook signature');
    }
    const digest = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    const expected = `sha256=${digest}`;
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Invalid WhatsApp webhook signature');
    }
  }

  extractInboundMessages(payload: unknown): WaInboundMessage[] {
    const out: WaInboundMessage[] = [];
    const root = payload as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            metadata?: { phone_number_id?: string };
            messages?: Array<{
              id?: string;
              from?: string;
              type?: string;
              text?: { body?: string };
            }>;
          };
        }>;
      }>;
    };
    for (const entry of root.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const phoneNumberId = change.value?.metadata?.phone_number_id?.trim();
        if (!phoneNumberId) continue;
        for (const msg of change.value?.messages ?? []) {
          if (!msg.from) continue;
          const messageId = msg.id?.trim() ?? '';
          if (msg.type === 'text' && msg.text?.body) {
            out.push({
              phoneNumberId,
              from: msg.from,
              messageId,
              kind: 'text',
              text: msg.text.body.trim(),
            });
          } else if (messageId) {
            out.push({
              phoneNumberId,
              from: msg.from,
              messageId,
              kind: 'unsupported',
            });
          }
        }
      }
    }
    return out;
  }

  async handlePayload(payload: unknown): Promise<void> {
    const messages = this.extractInboundMessages(payload);
    for (const msg of messages) {
      const channel = await this.channels.findByPhoneNumberId(msg.phoneNumberId);
      if (!channel) {
        this.logger.warn(`No channel for phone_number_id=${msg.phoneNumberId}`);
        continue;
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
        if (!acquired) continue;
      }

      try {
        if (!channel.botEnabled || !channel.accessToken?.trim()) continue;

        if (msg.kind === 'unsupported') {
          await this.bot.replyText(
            channel,
            conv,
            msg.from,
            'Please send a text message to book a court. Reply *menu* to see options.',
          );
          continue;
        }

        await this.bot.handleInbound(channel, conv, msg.from, msg.text!);
      } catch (e) {
        if (msg.messageId) await this.dedup.release(msg.messageId);
        const detail = e instanceof Error ? e.message : String(e);
        this.logger.error(`Meta webhook handler failed: ${detail}`);
      }
    }
  }
}
