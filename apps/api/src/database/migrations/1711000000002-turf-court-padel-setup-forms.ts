import { MigrationInterface, QueryRunner } from 'typeorm';

export class TurfCourtPadelSetupForms1711000000002 implements MigrationInterface {
  name = 'TurfCourtPadelSetupForms1711000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "turf_courts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(160) NOT NULL,
        "arenaLabel" varchar(120),
        "courtStatus" varchar(20) NOT NULL DEFAULT 'active',
        "imageUrls" jsonb,
        "ceilingHeightValue" decimal(8,2),
        "ceilingHeightUnit" varchar(2),
        "coveredType" varchar(20),
        "sideNetting" boolean,
        "netHeight" varchar(50),
        "boundaryType" varchar(10),
        "ventilation" jsonb,
        "lighting" varchar(24),
        "lengthM" decimal(10,2),
        "widthM" decimal(10,2),
        "surfaceType" varchar(24),
        "turfQuality" varchar(120),
        "shockAbsorptionLayer" boolean,
        "supportsFutsal" boolean NOT NULL DEFAULT false,
        "supportsCricket" boolean NOT NULL DEFAULT false,
        "futsalFormat" varchar(8),
        "futsalGoalPostsAvailable" boolean,
        "futsalGoalPostSize" varchar(80),
        "futsalLineMarkings" varchar(16),
        "cricketFormat" varchar(16),
        "cricketStumpsAvailable" boolean,
        "cricketBowlingMachine" boolean,
        "cricketPracticeMode" varchar(16),
        "futsalPricePerSlot" decimal(12,2),
        "cricketPricePerSlot" decimal(12,2),
        "peakPricing" jsonb,
        "discountMembership" jsonb,
        "slotDurationMinutes" int,
        "bufferBetweenSlotsMinutes" int,
        "allowParallelBooking" boolean,
        "amenities" jsonb,
        "rules" jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_turf_courts_tenant" ON "turf_courts" ("tenantId")
    `);

    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "courtStatus" varchar(20) NOT NULL DEFAULT 'active'
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "arenaLabel" varchar(120)
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "imageUrls" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "ceilingHeightValue" decimal(8,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "ceilingHeightUnit" varchar(2)
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "coveredType" varchar(20)
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "glassWalls" boolean DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "wallType" varchar(20)
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "lighting" varchar(80)
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "ventilation" varchar(80)
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "lengthM" decimal(10,2) DEFAULT 20
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "widthM" decimal(10,2) DEFAULT 10
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "matchType" varchar(16) DEFAULT 'doubles'
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "maxPlayers" int DEFAULT 4
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "pricePerSlot" decimal(12,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "peakPricing" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "membershipPrice" decimal(12,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "slotDurationMinutes" int
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "bufferBetweenSlotsMinutes" int
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "extras" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "amenities" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" ADD COLUMN IF NOT EXISTS "rules" jsonb
    `);

    await queryRunner.query(`
      UPDATE "padel_courts" SET "courtStatus" = 'maintenance' WHERE "isActive" = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "turf_courts"`);

    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "rules"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "amenities"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "extras"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "bufferBetweenSlotsMinutes"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "slotDurationMinutes"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "membershipPrice"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "peakPricing"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "pricePerSlot"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "maxPlayers"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "matchType"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "widthM"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "lengthM"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "ventilation"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "lighting"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "wallType"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "glassWalls"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "coveredType"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "ceilingHeightUnit"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "ceilingHeightValue"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "imageUrls"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "arenaLabel"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "courtStatus"
    `);
  }
}
