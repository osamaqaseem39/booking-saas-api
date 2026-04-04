import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../apps/api/src/app.module';
import dataSource from '../apps/api/src/database/typeorm.config';

let cachedApp: NestExpressApplication | undefined;
let bootstrapPromise: Promise<NestExpressApplication> | undefined;

/** Runs even when RUN_STARTUP_MIGRATIONS=false (Vercel default). Idempotent. */
let ensureLocationDetailsColumnPromise: Promise<void> | undefined;

async function ensureBusinessLocationDetailsColumn(): Promise<void> {
  if (!ensureLocationDetailsColumnPromise) {
    ensureLocationDetailsColumnPromise = (async () => {
      try {
        await dataSource.initialize();
        await dataSource.query(`
          ALTER TABLE "business_locations"
          ADD COLUMN IF NOT EXISTS "details" text
        `);
      } catch (err) {
        console.error(
          '[DB] ensure business_locations.details column failed:',
          err,
        );
        throw err;
      } finally {
        if (dataSource.isInitialized) {
          await dataSource.destroy();
        }
      }
    })();
  }
  await ensureLocationDetailsColumnPromise;
}

async function getOrCreateApp(): Promise<NestExpressApplication> {
  if (cachedApp) {
    return cachedApp;
  }

  // Cold starts can receive concurrent requests. Ensure only one bootstrap path
  // creates the Nest app (and the DB pool) at a time.
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      // TypeORM migrations run inside Nest (AppModule) when RUN_STARTUP_MIGRATIONS=true
      // (see TypeOrmModule.forRoot migrationsRun). No separate DataSource migration pass here.
      if (
        (process.env.RUN_STARTUP_MIGRATIONS ?? '').toLowerCase().trim() ===
          'true' &&
        !(globalThis as any).__startupMigrationLogOnce
      ) {
        (globalThis as any).__startupMigrationLogOnce = true;
        console.log(
          '[DB] RUN_STARTUP_MIGRATIONS=true — pending TypeORM migrations will run on Nest DB connect.',
        );
      } else if (!(globalThis as any).__startupMigrationLogOnce) {
        (globalThis as any).__startupMigrationLogOnce = true;
        console.log(
          '[DB] startup migrations skipped (set RUN_STARTUP_MIGRATIONS=true to run them on boot via Nest TypeORM, or run `npm run migration:run` with POSTGRES_URL / POSTGRES_URL_NON_POOLING).',
        );
      }

      await ensureBusinessLocationDetailsColumn();

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

      // Match the working Vercel entrypoint pattern:
      // enable CORS before init, so preflight OPTIONS gets CORS headers.
      cachedApp.enableCors({
        // Keep it open in this phase to prevent CORS-related 500s
        // from breaking the browser preflight.
        origin: true,
        credentials: true,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Requested-With',
          'Accept',
          'Origin',
          // Custom app headers (used by your frontend/guards)
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
  // Set a timeout to ensure response is sent before Vercel's timeout.
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        error: 'Gateway Timeout',
        message: 'Request took too long to process',
      });
    }
  }, 55000); // 55 seconds (5 seconds before Vercel's 60s timeout)

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
