import { MigrationInterface, QueryRunner } from 'typeorm';

export class TurfCourtsAndBookings1711000000031 implements MigrationInterface {
  name = 'TurfCourtsAndBookings1711000000031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "turf_courts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "branchId" uuid NOT NULL,
        "name" varchar(160) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'active',
        "length" decimal(10,2),
        "width" decimal(10,2),
        "ceilingHeight" decimal(10,2),
        "coveredType" varchar(20) NOT NULL DEFAULT 'open',
        "surfaceType" varchar(80),
        "turfQuality" varchar(80),
        "supportedSports" text[] NOT NULL DEFAULT '{}',
        "sportConfig" jsonb,
        "pricing" jsonb,
        "slotDuration" integer NOT NULL DEFAULT 60,
        "bufferTime" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_turf_courts_branch" ON "turf_courts" ("branchId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_turf_courts_tenant" ON "turf_courts" ("tenantId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_turf_courts_supported_sports_gin"
      ON "turf_courts" USING GIN ("supportedSports")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "turf_bookings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "branchId" uuid NOT NULL,
        "turfId" uuid NOT NULL,
        "bookingDate" date NOT NULL,
        "sportType" varchar(16) NOT NULL,
        "slotStartTime" time NOT NULL,
        "slotEndTime" time NOT NULL,
        "startDatetime" timestamptz NOT NULL,
        "endDatetime" timestamptz NOT NULL,
        "totalAmount" decimal(12,2) NOT NULL,
        "bookingStatus" varchar(20) NOT NULL DEFAULT 'pending',
        "paymentStatus" varchar(20) NOT NULL DEFAULT 'pending',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_turf_bookings_turf"
          FOREIGN KEY ("turfId") REFERENCES "turf_courts"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_turf_bookings_turf_start_datetime"
          UNIQUE ("turfId", "startDatetime")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_turf_bookings_turf_start_datetime"
      ON "turf_bookings" ("turfId", "startDatetime")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_turf_bookings_booking_date"
      ON "turf_bookings" ("bookingDate")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "turf_bookings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "turf_courts"`);
  }
}
