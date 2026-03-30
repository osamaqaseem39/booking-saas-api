import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

export function applyHttpGlobals(app: NestExpressApplication): void {
  const originsEnv = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '';
  const allowedOrigins = originsEnv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
}

export async function createNestExpressApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  applyHttpGlobals(app);
  return app;
}

export async function bootstrapHttpApp(): Promise<void> {
  const app = await createNestExpressApp();
  await app.listen(process.env.PORT ?? 3000);
}
