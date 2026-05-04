import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

function swaggerEnabled(): boolean {
  const v = process.env.ENABLE_SWAGGER?.trim().toLowerCase();
  if (v === 'false' || v === '0') return false;
  return true;
}

export function setupSwaggerIfEnabled(app: NestExpressApplication): void {
  if (!swaggerEnabled()) {
    const v = process.env.ENABLE_SWAGGER?.trim().toLowerCase();
    if (v === 'false' || v === '0') {
      console.log('[OpenAPI] Swagger UI disabled (ENABLE_SWAGGER=false).');
    }
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

  try {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(path, app, document, {
      swaggerOptions: { persistAuthorization: true },
      customSiteTitle: 'Velay API Docs',
    });
    const mount = path.startsWith('/') ? path : `/${path}`;
    console.log(`[OpenAPI] Swagger UI → ${mount} (JSON → ${mount}-json)`);
  } catch (err) {
    console.error('[OpenAPI] Swagger setup failed:', err);
  }
}
