import type { Express } from 'express';
import { bootstrapHttpApp, createNestExpressApp, setupSwaggerIfEnabled } from './bootstrap-http';
import { bootstrapEnterpriseApp } from './bootstrap-enterprise';
import { shouldRunStartupMigrations } from './database/migration-startup.util';

let cachedServer: Express | null = null;
let initializingServer: Promise<Express> | null = null;

async function createServer(): Promise<Express> {
  if (cachedServer) {
    return cachedServer;
  }
  if (initializingServer) {
    return initializingServer;
  }

  initializingServer = (async () => {
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

    const app = await createNestExpressApp();
    setupSwaggerIfEnabled(app);
    await app.init();
    cachedServer = app.getHttpAdapter().getInstance();
    return cachedServer;
  })();

  try {
    return await initializingServer;
  } finally {
    initializingServer = null;
  }
}

export default async function handler(req: any, res: any): Promise<void> {
  const server = await createServer();
  server(req, res);
}

if (require.main === module) {
  const mode = process.env.API_MODE ?? 'legacy';
  if (mode === 'enterprise') {
    void bootstrapEnterpriseApp();
  } else {
    void bootstrapHttpApp();
  }
}
