import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { WhatsappChannel } from './entities/whatsapp-channel.entity';
import {
  WhatsappMessage,
  type WhatsappMessageDeliveryStatus,
} from './entities/whatsapp-message.entity';
import type { WhatsappConversation } from './entities/whatsapp-conversation.entity';

@Injectable()
export class WhatsappMessagesService {
  constructor(
    @InjectRepository(WhatsappMessage)
    private readonly messages: Repository<WhatsappMessage>,
  ) {}

  async appendInbound(input: {
    conversation: WhatsappConversation;
    channel: WhatsappChannel;
    body: string;
    externalMessageId?: string;
  }): Promise<WhatsappMessage> {
    return this.messages.save(
      this.messages.create({
        conversationId: input.conversation.id,
        channelId: input.channel.id,
        tenantId: input.channel.tenantId,
        customerWaId: input.conversation.customerWaId,
        direction: 'inbound',
        body: input.body,
        externalMessageId: input.externalMessageId ?? null,
        deliveryStatus: 'received',
      }),
    );
  }

  async appendOutbound(input: {
    conversation: WhatsappConversation;
    channel: WhatsappChannel;
    body: string;
    deliveryStatus: WhatsappMessageDeliveryStatus;
    deliveryError?: string | null;
  }): Promise<WhatsappMessage> {
    return this.messages.save(
      this.messages.create({
        conversationId: input.conversation.id,
        channelId: input.channel.id,
        tenantId: input.channel.tenantId,
        customerWaId: input.conversation.customerWaId,
        direction: 'outbound',
        body: input.body,
        deliveryStatus: input.deliveryStatus,
        deliveryError: input.deliveryError ?? null,
      }),
    );
  }

  async markSent(id: string): Promise<void> {
    await this.messages.update(id, {
      deliveryStatus: 'sent',
      deliveryError: null,
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.messages.update(id, {
      deliveryStatus: 'failed',
      deliveryError: error.slice(0, 2000),
    });
  }

  async listPendingOutbound(limit = 20): Promise<WhatsappMessage[]> {
    return this.messages.find({
      where: { direction: 'outbound', deliveryStatus: 'pending' },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async listForConversation(
    conversationId: string,
    limit = 100,
  ): Promise<WhatsappMessage[]> {
    return this.messages.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  toRow(m: WhatsappMessage) {
    return {
      id: m.id,
      conversationId: m.conversationId,
      channelId: m.channelId,
      tenantId: m.tenantId,
      customerWaId: m.customerWaId,
      direction: m.direction,
      body: m.body,
      externalMessageId: m.externalMessageId ?? null,
      deliveryStatus: m.deliveryStatus,
      deliveryError: m.deliveryError ?? null,
      createdAt: m.createdAt.toISOString(),
    };
  }
}
