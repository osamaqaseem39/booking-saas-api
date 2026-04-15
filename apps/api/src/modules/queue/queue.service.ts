import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService {
  constructor(@InjectQueue('notifications') private readonly notificationsQueue: Queue) {}

  async enqueueWelcomeEmail(userId: string, email: string): Promise<void> {
    await this.notificationsQueue.add(
      'send-welcome-email',
      { userId, email },
      { removeOnComplete: 1000, removeOnFail: 5000, attempts: 3 },
    );
  }
}
