import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  async process(job: Job<{ userId: string; email: string }>): Promise<void> {
    if (job.name === 'send-welcome-email') {
      this.logger.log(`Queue: sending welcome email to ${job.data.email}`);
      return;
    }

    this.logger.warn(`Unknown job name received: ${job.name}`);
  }
}
