import { Inject, Injectable, Optional } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@libs/database/redis/redis.module';

@Injectable()
export class HealthService {
  constructor(@Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis) {}

  async getStatus(): Promise<{
    status: 'ok' | 'degraded';
    service: string;
    redis: 'ok' | 'skipped' | 'error';
  }> {
    if (!this.redis) {
      return { status: 'ok', service: 'backend-saas', redis: 'skipped' };
    }
    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        return { status: 'degraded', service: 'backend-saas', redis: 'error' };
      }
      return { status: 'ok', service: 'backend-saas', redis: 'ok' };
    } catch {
      return { status: 'degraded', service: 'backend-saas', redis: 'error' };
    }
  }
}
