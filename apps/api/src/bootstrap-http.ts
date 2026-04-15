import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { DatabaseQueryExceptionFilter } from './common/filters/database-query-exception.filter';

export function applyHttpGlobals(app: NestExpressApplication): void {
  const originsEnv = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '';
  const allowedOrigins = originsEnv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Explicit CORS middleware to ensure preflight `OPTIONS` requests
  // never hit a 404/route-miss without `Access-Control-Allow-Origin`.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin as string | undefined;

    if (origin) {
      // If no CORS env is configured, reflect the request origin.
      const allowOrigin =
        allowedOrigins.length === 0 || allowedOrigins.includes(origin);
      res.setHeader(
        'Access-Control-Allow-Origin',
        allowOrigin ? origin : 'null',
      );
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    );

    // Let the client request headers decide which headers we allow,
    // so preflight doesn't fail when the frontend sends extra headers.
    const requestHeaders = req.header('Access-Control-Request-Headers');
    res.setHeader(
      'Access-Control-Allow-Headers',
      requestHeaders ??
        'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-User-Id, X-Tenant-Id',
    );

    if (req.method === 'OPTIONS') {
      res.status(204).send();
      return;
    }

    next();
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
  app.useGlobalFilters(
    new DatabaseQueryExceptionFilter(),
    new ApiExceptionFilter(),
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
