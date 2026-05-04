import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

function swaggerEnabled(): boolean {
  const v = process.env.ENABLE_SWAGGER?.trim().toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

export function setupSwaggerIfEnabled(app: NestExpressApplication): void {
  if (!swaggerEnabled()) {
    return;
  }

  const path = process.env.SWAGGER_PATH?.trim() || 'api-docs';

  const config = new DocumentBuilder()
    .setTitle('Velay API')
    .setDescription('HTTP API for bookings and facility SaaS')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'JWT from POST /auth/login (use the value returned as access token)',
      },
      'access-token',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Tenant-Id',
        in: 'header',
        description:
          'Tenant context for routes that expect X-Tenant-Id (see bookings endpoints)',
      },
      'tenant-id',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(path, app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Velay API Docs',
  });
}
