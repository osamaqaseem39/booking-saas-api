import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../apps/api/src/app.module';
import { applyHttpGlobals } from '../apps/api/src/bootstrap-http';
import { shouldRunStartupMigrations } from '../apps/api/src/database/migration-startup.util';

async function bootstrap(): Promise<void> {
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

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  applyHttpGlobals(app);
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
