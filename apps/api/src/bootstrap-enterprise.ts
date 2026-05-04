import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { EnterpriseAppModule } from './enterprise-app.module';
import { GlobalExceptionFilter } from '@libs/common/filters/global-exception.filter';
import { RequestLoggingInterceptor } from '@libs/common/interceptors/request-logging.interceptor';
import { setupSwaggerIfEnabled } from './swagger.setup';

export async function bootstrapEnterpriseApp(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(EnterpriseAppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  await app.init();
  setupSwaggerIfEnabled(app);

  await app.listen(process.env.PORT ?? 3000);
}
