import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../apps/api/src/app.module';
import dataSource from '../apps/api/src/database/typeorm.config';

let cachedApp: NestExpressApplication | undefined;
let migrationsPromise: Promise<void> | undefined;
let bootstrapPromise: Promise<NestExpressApplication> | undefined;

async function bootstrap(): Promise<any> {
  if (cachedApp) {
    return cachedApp.getHttpAdapter().getInstance();
  }

  // Cold starts can receive concurrent requests. Ensure only one bootstrap path
  // creates the Nest app (and the DB pool) at a time.
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      // Running startup migrations in serverless can cause connection spikes.
      // Keep this off by default and enable only when explicitly requested.
      const runStartupMigrations =
        (process.env.RUN_STARTUP_MIGRATIONS ?? 'false').toLowerCase() ===
        'true';
      if (runStartupMigrations && !migrationsPromise) {
        migrationsPromise = (async () => {
          try {
            await dataSource.initialize();
            // Run migrations first (normal/expected path).
            await dataSource.runMigrations();

            // Fallback: in some deployments, the migration table can get out of
            // sync with the actual schema. Ensure the core IAM tables exist
            // so bootstrapping (and `/auth/login`) doesn't crash.
            await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

            await dataSource.query(`
            CREATE TABLE IF NOT EXISTS "users" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              "fullName" varchar(150) NOT NULL,
              "email" varchar(180) NOT NULL UNIQUE,
              "phone" varchar(30),
              "passwordHash" varchar(255) NULL,
              "isActive" boolean NOT NULL DEFAULT true,
              "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
            );
          `);
          // Ensure IAM baseline columns exist even if an older schema exists.
          // (Some deployments may have created `users` without password support.)
          await dataSource.query(`
            ALTER TABLE "users"
            ADD COLUMN IF NOT EXISTS "passwordHash" varchar(255) NULL
          `);
          await dataSource.query(`
            CREATE TABLE IF NOT EXISTS "roles" (
              "code" varchar(50) PRIMARY KEY,
              "name" varchar(120) NOT NULL,
              "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
            );
          `);
          await dataSource.query(`
            CREATE TABLE IF NOT EXISTS "user_roles" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              "userId" uuid NOT NULL,
              "roleCode" varchar(50) NOT NULL,
              "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
              CONSTRAINT "uq_user_role" UNIQUE ("userId", "roleCode"),
              CONSTRAINT "fk_user_roles_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
              CONSTRAINT "fk_user_roles_role" FOREIGN KEY ("roleCode") REFERENCES "roles"("code") ON DELETE RESTRICT
            );
          `);
          await dataSource.query(`
            CREATE TABLE IF NOT EXISTS "businesses" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              "tenantId" uuid NOT NULL UNIQUE,
              "businessName" varchar(180) NOT NULL UNIQUE,
              "legalName" varchar(220),
              "vertical" varchar(80) NOT NULL,
              "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
            );
          `);
          await dataSource.query(`
            CREATE TABLE IF NOT EXISTS "business_memberships" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              "businessId" uuid NOT NULL,
              "userId" uuid NOT NULL,
              "membershipRole" varchar(30) NOT NULL,
              "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
              CONSTRAINT "uq_business_membership" UNIQUE ("businessId", "userId"),
              CONSTRAINT "fk_membership_business" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE,
              CONSTRAINT "fk_membership_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
            );
          `);
          await dataSource.query(`
            CREATE TABLE IF NOT EXISTS "business_locations" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              "businessId" uuid NOT NULL,
              "name" varchar(200) NOT NULL,
              "locationType" varchar(80) NOT NULL DEFAULT 'other',
              "facilityTypes" text[] NOT NULL DEFAULT '{}',
              "addressLine" varchar(400),
              "city" varchar(120),
              "phone" varchar(60),
              "isActive" boolean NOT NULL DEFAULT true,
              "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
              CONSTRAINT "fk_business_locations_business" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE
            );
          `);
          await dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_business_locations_business"
            ON "business_locations" ("businessId")
          `);
          // Ensure business location baseline columns exist for out-of-sync schemas.
          await dataSource.query(`
            ALTER TABLE "business_locations"
            ADD COLUMN IF NOT EXISTS "locationType" varchar(80) NOT NULL DEFAULT 'other'
          `);
          await dataSource.query(`
            ALTER TABLE "business_locations"
            ADD COLUMN IF NOT EXISTS "facilityTypes" text[] NOT NULL DEFAULT '{}'
          `);
          await dataSource.query(`
            ALTER TABLE "business_locations"
            ADD COLUMN IF NOT EXISTS "area" varchar(120)
          `);
          await dataSource.query(`
            ALTER TABLE "business_locations"
            ADD COLUMN IF NOT EXISTS "country" varchar(120)
          `);
          await dataSource.query(`
            ALTER TABLE "business_locations"
            ADD COLUMN IF NOT EXISTS "latitude" decimal(10,6)
          `);
          await dataSource.query(`
            ALTER TABLE "business_locations"
            ADD COLUMN IF NOT EXISTS "longitude" decimal(10,6)
          `);
          await dataSource.query(`
            ALTER TABLE "business_locations"
            ADD COLUMN IF NOT EXISTS "manager" varchar(120)
          `);
          await dataSource.query(`
            ALTER TABLE "business_locations"
            ADD COLUMN IF NOT EXISTS "workingHours" jsonb
          `);
          await dataSource.query(`
            ALTER TABLE "business_locations"
            ADD COLUMN IF NOT EXISTS "timezone" varchar(80)
          `);
          await dataSource.query(`
            ALTER TABLE "business_locations"
            ADD COLUMN IF NOT EXISTS "currency" varchar(8) NOT NULL DEFAULT 'PKR'
          `);
          await dataSource.query(`
            ALTER TABLE "business_locations"
            ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'active'
          `);
          await dataSource.query(`
            ALTER TABLE "business_locations"
            ADD COLUMN IF NOT EXISTS "logo" varchar(2048)
          `);
          await dataSource.query(`
            ALTER TABLE "business_locations"
            ADD COLUMN IF NOT EXISTS "bannerImage" varchar(2048)
          `);
          await dataSource.query(`
            ALTER TABLE "business_locations"
            ADD COLUMN IF NOT EXISTS "gallery" text[] NOT NULL DEFAULT '{}'
          `);
          // Ensure booking tables exist even if migration history is out of sync.
          await dataSource.query(`
            CREATE TABLE IF NOT EXISTS "bookings" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              "tenantId" uuid NOT NULL,
              "userId" uuid NOT NULL,
              "sportType" varchar(16) NOT NULL,
              "bookingDate" date NOT NULL,
              "subTotal" decimal(12,2) NOT NULL,
              "discount" decimal(12,2) NOT NULL DEFAULT 0,
              "tax" decimal(12,2) NOT NULL DEFAULT 0,
              "totalAmount" decimal(12,2) NOT NULL,
              "paymentStatus" varchar(16) NOT NULL,
              "paymentMethod" varchar(16) NOT NULL,
              "transactionId" varchar(120),
              "paidAt" TIMESTAMPTZ,
              "bookingStatus" varchar(20) NOT NULL,
              "notes" text,
              "cancellationReason" text,
              "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
              "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
              CONSTRAINT "fk_bookings_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT
            );
          `);
          await dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_bookings_tenant" ON "bookings" ("tenantId")
          `);
          await dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_bookings_user" ON "bookings" ("userId")
          `);
          await dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_bookings_date" ON "bookings" ("bookingDate")
          `);
          await dataSource.query(`
            CREATE TABLE IF NOT EXISTS "booking_items" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              "bookingId" uuid NOT NULL,
              "courtKind" varchar(32) NOT NULL,
              "courtId" uuid NOT NULL,
              "slotId" varchar(120),
              "startTime" varchar(5) NOT NULL,
              "endTime" varchar(5) NOT NULL,
              "price" decimal(12,2) NOT NULL,
              "currency" varchar(8) NOT NULL DEFAULT 'PKR',
              "itemStatus" varchar(20) NOT NULL,
              CONSTRAINT "fk_booking_items_booking" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE
            );
          `);
            await dataSource.query(`
            CREATE INDEX IF NOT EXISTS "idx_booking_items_booking" ON "booking_items" ("bookingId")
          `);
          } finally {
            // Always close the connection to avoid keeping serverless sockets open.
            if (dataSource.isInitialized) {
              await dataSource.destroy();
            }
          }
        })();
      }
      if (migrationsPromise) {
        await migrationsPromise;
      } else if (!(globalThis as any).__startupMigrationLogOnce) {
        (globalThis as any).__startupMigrationLogOnce = true;
        console.log(
          '[DB] startup migrations skipped (RUN_STARTUP_MIGRATIONS=false)',
        );
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

  await bootstrapPromise;
  if (!cachedApp) {
    throw new Error('Nest application failed to bootstrap');
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
