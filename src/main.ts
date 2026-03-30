import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../apps/api/src/app.module';
import dataSource from '../apps/api/src/database/typeorm.config';

let cachedApp: NestExpressApplication;
let migrationsPromise: Promise<void> | undefined;

async function bootstrap() {
  if (!cachedApp) {
    // Ensure DB schema exists before Nest controllers/services run.
    // This prevents runtime errors like `relation "users" does not exist`.
    if (!migrationsPromise) {
      migrationsPromise = (async () => {
        try {
          await dataSource.initialize();
          await dataSource.runMigrations();
        } finally {
          // Always close the connection to avoid keeping serverless sockets open.
          if (dataSource.isInitialized) {
            await dataSource.destroy();
          }
        }
      })();
    }
    await migrationsPromise;

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
  }

  return cachedApp.getHttpAdapter().getInstance();
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
