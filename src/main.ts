import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../apps/api/src/app.module';
import { shouldRunStartupMigrations } from '../apps/api/src/database/migration-startup.util';

let cachedApp: NestExpressApplication | undefined;
let bootstrapPromise: Promise<NestExpressApplication> | undefined;

async function getOrCreateApp(): Promise<NestExpressApplication> {
  if (cachedApp) {
    return cachedApp;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      if (!(globalThis as any).__startupMigrationLogOnce) {
        (globalThis as any).__startupMigrationLogOnce = true;
        if (shouldRunStartupMigrations()) {
          console.log(
            '[DB] TypeORM migrations will run on connect (production default when RUN_STARTUP_MIGRATIONS is unset, or set to true).',
          );
        } else {
          console.log(
            '[DB] TypeORM migrations skipped (non-production, or RUN_STARTUP_MIGRATIONS=false). Remove RUN_STARTUP_MIGRATIONS in Vercel prod to enable auto-migrate, set it to true, or run npm run migration:run.',
          );
        }
      }

      cachedApp = await NestFactory.create<NestExpressApplication>(AppModule);

      cachedApp.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: {
            enableImplicitConversion: true,
          },
        }),
      );

      cachedApp.enableCors({
        origin: true,
        credentials: true,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Requested-With',
          'Accept',
          'Origin',
          'X-User-Id',
          'X-Tenant-Id',
        ],
        exposedHeaders: ['Content-Range', 'X-Total-Count'],
        maxAge: 600,
      });

      await cachedApp.init();
      return cachedApp;
    })().finally(() => {
      bootstrapPromise = undefined;
    });
  }

  const app = await bootstrapPromise;
  if (!app) {
    throw new Error('Nest application failed to bootstrap');
  }
  return app;
}

async function bootstrap(): Promise<any> {
  const app = await getOrCreateApp();
  return app.getHttpAdapter().getInstance();
}

export default async function handler(req: any, res: any): Promise<void> {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        error: 'Gateway Timeout',
        message: 'Request took too long to process',
      });
    }
  }, 55000);

  try {
    const expressApp = await bootstrap();
    expressApp(req, res);

    res.on?.('finish', () => {
      clearTimeout(timeout);
    });
  } catch (error) {
    clearTimeout(timeout);

    console.error('Handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
