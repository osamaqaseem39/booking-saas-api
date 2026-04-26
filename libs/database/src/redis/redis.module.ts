import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';
const redisLogger = new Logger('RedisModule');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL')?.trim();
        const host = config.get<string>('REDIS_HOST')?.trim();
        const shouldLogErrors =
          (config.get<string>('REDIS_LOG_ERRORS') ?? '').toLowerCase() === 'true';

        // Redis is optional in some deployments. If not configured, disable silently.
        if (!url && !host) {
          redisLogger.log('Redis disabled (no REDIS_URL/REDIS_HOST configured).');
          return null;
        }

        const commonOptions = {
          maxRetriesPerRequest: null as const,
          lazyConnect: true,
        };

        const client = url
          ? new Redis(url, commonOptions)
          : new Redis({
              host: host || 'localhost',
              port: config.get<number>('REDIS_PORT', 6379),
              password: config.get<string>('REDIS_PASSWORD'),
              ...commonOptions,
            });

        client.on('error', (err) => {
          if (!shouldLogErrors) return;
          redisLogger.warn(`Redis connection error: ${err.message}`);
        });

        // Start connect asynchronously to avoid blocking app bootstrap.
        void client.connect().catch((err) => {
          if (!shouldLogErrors) return;
          redisLogger.warn(`Redis initial connect failed: ${err.message}`);
        });

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
