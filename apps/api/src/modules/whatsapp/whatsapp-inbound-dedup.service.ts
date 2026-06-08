import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { WhatsappProcessedMessage } from './entities/whatsapp-processed-message.entity';

const RETENTION_DAYS = 7;

@Injectable()
export class WhatsappInboundDedupService {
  constructor(
    @InjectRepository(WhatsappProcessedMessage)
    private readonly processed: Repository<WhatsappProcessedMessage>,
  ) {}

  async tryAcquire(messageId: string): Promise<boolean> {
    const id = messageId.trim();
    if (!id) return true;
    void this.pruneOld().catch(() => undefined);
    try {
      await this.processed.insert({ messageId: id });
      return true;
    } catch {
      return false;
    }
  }

  async release(messageId: string): Promise<void> {
    const id = messageId.trim();
    if (!id) return;
    await this.processed.delete({ messageId: id });
  }

  private async pruneOld(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await this.processed.delete({ processedAt: LessThan(cutoff) });
  }
}
