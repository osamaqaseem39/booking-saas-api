import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WhatsappConversation,
  type WhatsappConversationState,
  type WhatsappConversationStep,
} from './entities/whatsapp-conversation.entity';

const SESSION_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class WhatsappConversationsService {
  constructor(
    @InjectRepository(WhatsappConversation)
    private readonly conversations: Repository<WhatsappConversation>,
  ) {}

  async getOrCreate(input: {
    channelId: string;
    tenantId: string;
    customerWaId: string;
  }): Promise<WhatsappConversation> {
    const existing = await this.conversations.findOne({
      where: {
        channelId: input.channelId,
        customerWaId: input.customerWaId,
      },
    });
    const now = new Date();
    if (existing) {
      if (now.getTime() - existing.lastMessageAt.getTime() > SESSION_TTL_MS) {
        existing.step = 'menu';
        existing.state = {};
      }
      existing.lastMessageAt = now;
      return this.conversations.save(existing);
    }
    return this.conversations.save(
      this.conversations.create({
        channelId: input.channelId,
        tenantId: input.tenantId,
        customerWaId: input.customerWaId,
        step: 'menu',
        state: {},
        lastMessageAt: now,
      }),
    );
  }

  async saveStep(
    conv: WhatsappConversation,
    step: WhatsappConversationStep,
    state: WhatsappConversationState,
  ): Promise<WhatsappConversation> {
    conv.step = step;
    conv.state = state;
    conv.lastMessageAt = new Date();
    return this.conversations.save(conv);
  }

  async reset(conv: WhatsappConversation): Promise<WhatsappConversation> {
    return this.saveStep(conv, 'menu', {});
  }
}
