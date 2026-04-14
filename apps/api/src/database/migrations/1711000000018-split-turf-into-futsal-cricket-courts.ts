import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces combined `turf_courts` with separate `futsal_courts` and `cricket_courts`.
 * Preserves turf row UUID when the pitch was single-sport; splits `both` into two new UUIDs
 * and remaps booking_items + court_slot_booking_blocks.
 */
export class SplitTurfIntoFutsalCricketCourts1711000000018 implements MigrationInterface {
  name = 'SplitTurfIntoFutsalCricketCourts1711000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTurf = await queryRunner.hasTable('turf_courts');
    if (!hasTurf) {
      await this.createEmptySplitTables(queryRunner);
      return;
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "_turf_both_map" (
        "turfId" uuid PRIMARY KEY,
        "futsalId" uuid NOT NULL,
        "cricketId" uuid NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "futsal_courts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "businessLocationId" uuid,
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
        "futsalFormat" varchar(8),
        "futsalGoalPostsAvailable" boolean,
        "futsalGoalPostSize" varchar(80),
        "futsalLineMarkings" varchar(16),
        "pricePerSlot" decimal(12,2),
        "peakPricing" jsonb,
        "discountMembership" jsonb,
        "slotDurationMinutes" int,
        "bufferBetweenSlotsMinutes" int,
        "allowParallelBooking" boolean,
        "amenities" jsonb,
        "rules" jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_futsal_courts" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "cricket_courts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "businessLocationId" uuid,
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
        "cricketFormat" varchar(16),
        "cricketStumpsAvailable" boolean,
        "cricketBowlingMachine" boolean,
        "cricketPracticeMode" varchar(16),
        "pricePerSlot" decimal(12,2),
        "peakPricing" jsonb,
        "discountMembership" jsonb,
        "slotDurationMinutes" int,
        "bufferBetweenSlotsMinutes" int,
        "allowParallelBooking" boolean,
        "amenities" jsonb,
        "rules" jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cricket_courts" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "futsal_courts" (
        "id", "tenantId", "businessLocationId", "name", "arenaLabel", "courtStatus",
        "imageUrls", "ceilingHeightValue", "ceilingHeightUnit", "coveredType", "sideNetting",
        "netHeight", "boundaryType", "ventilation", "lighting", "lengthM", "widthM",
        "surfaceType", "turfQuality", "shockAbsorptionLayer",
        "futsalFormat", "futsalGoalPostsAvailable", "futsalGoalPostSize", "futsalLineMarkings",
        "pricePerSlot", "peakPricing", "discountMembership", "slotDurationMinutes",
        "bufferBetweenSlotsMinutes", "allowParallelBooking", "amenities", "rules",
        "createdAt", "updatedAt"
      )
      SELECT
        t."id",
        t."tenantId",
        t."businessLocationId",
        t."name",
        t."arenaLabel",
        t."courtStatus",
        t."imageUrls",
        t."ceilingHeightValue",
        t."ceilingHeightUnit",
        t."coveredType",
        t."sideNetting",
        t."netHeight",
        t."boundaryType",
        t."ventilation",
        t."lighting",
        t."lengthM",
        t."widthM",
        t."surfaceType",
        t."turfQuality",
        t."shockAbsorptionLayer",
        t."futsalFormat",
        t."futsalGoalPostsAvailable",
        t."futsalGoalPostSize",
        t."futsalLineMarkings",
        t."futsalPricePerSlot",
        t."peakPricing",
        t."discountMembership",
        t."slotDurationMinutes",
        t."bufferBetweenSlotsMinutes",
        t."allowParallelBooking",
        t."amenities",
        t."rules",
        t."createdAt",
        t."updatedAt"
      FROM "turf_courts" t
      WHERE t."supportsFutsal" = true AND COALESCE(t."supportsCricket", false) = false
    `);

    await queryRunner.query(`
      INSERT INTO "cricket_courts" (
        "id", "tenantId", "businessLocationId", "name", "arenaLabel", "courtStatus",
        "imageUrls", "ceilingHeightValue", "ceilingHeightUnit", "coveredType", "sideNetting",
        "netHeight", "boundaryType", "ventilation", "lighting", "lengthM", "widthM",
        "surfaceType", "turfQuality", "shockAbsorptionLayer",
        "cricketFormat", "cricketStumpsAvailable", "cricketBowlingMachine", "cricketPracticeMode",
        "pricePerSlot", "peakPricing", "discountMembership", "slotDurationMinutes",
        "bufferBetweenSlotsMinutes", "allowParallelBooking", "amenities", "rules",
        "createdAt", "updatedAt"
      )
      SELECT
        t."id",
        t."tenantId",
        t."businessLocationId",
        t."name",
        t."arenaLabel",
        t."courtStatus",
        t."imageUrls",
        t."ceilingHeightValue",
        t."ceilingHeightUnit",
        t."coveredType",
        t."sideNetting",
        t."netHeight",
        t."boundaryType",
        t."ventilation",
        t."lighting",
        t."lengthM",
        t."widthM",
        t."surfaceType",
        t."turfQuality",
        t."shockAbsorptionLayer",
        t."cricketFormat",
        t."cricketStumpsAvailable",
        t."cricketBowlingMachine",
        t."cricketPracticeMode",
        t."cricketPricePerSlot",
        t."peakPricing",
        t."discountMembership",
        t."slotDurationMinutes",
        t."bufferBetweenSlotsMinutes",
        t."allowParallelBooking",
        t."amenities",
        t."rules",
        t."createdAt",
        t."updatedAt"
      FROM "turf_courts" t
      WHERE t."supportsCricket" = true AND COALESCE(t."supportsFutsal", false) = false
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        r RECORD;
        fid uuid;
        cid uuid;
      BEGIN
        FOR r IN
          SELECT * FROM "turf_courts" t
          WHERE t."supportsFutsal" = true AND t."supportsCricket" = true
        LOOP
          fid := gen_random_uuid();
          cid := gen_random_uuid();
          INSERT INTO "_turf_both_map" ("turfId", "futsalId", "cricketId")
          VALUES (r."id", fid, cid);

          INSERT INTO "futsal_courts" (
            "id", "tenantId", "businessLocationId", "name", "arenaLabel", "courtStatus",
            "imageUrls", "ceilingHeightValue", "ceilingHeightUnit", "coveredType", "sideNetting",
            "netHeight", "boundaryType", "ventilation", "lighting", "lengthM", "widthM",
            "surfaceType", "turfQuality", "shockAbsorptionLayer",
            "futsalFormat", "futsalGoalPostsAvailable", "futsalGoalPostSize", "futsalLineMarkings",
            "pricePerSlot", "peakPricing", "discountMembership", "slotDurationMinutes",
            "bufferBetweenSlotsMinutes", "allowParallelBooking", "amenities", "rules",
            "createdAt", "updatedAt"
          ) VALUES (
            fid, r."tenantId", r."businessLocationId", r."name", r."arenaLabel", r."courtStatus",
            r."imageUrls", r."ceilingHeightValue", r."ceilingHeightUnit", r."coveredType", r."sideNetting",
            r."netHeight", r."boundaryType", r."ventilation", r."lighting", r."lengthM", r."widthM",
            r."surfaceType", r."turfQuality", r."shockAbsorptionLayer",
            r."futsalFormat", r."futsalGoalPostsAvailable", r."futsalGoalPostSize", r."futsalLineMarkings",
            r."futsalPricePerSlot", r."peakPricing", r."discountMembership", r."slotDurationMinutes",
            r."bufferBetweenSlotsMinutes", r."allowParallelBooking", r."amenities", r."rules",
            r."createdAt", r."updatedAt"
          );

          INSERT INTO "cricket_courts" (
            "id", "tenantId", "businessLocationId", "name", "arenaLabel", "courtStatus",
            "imageUrls", "ceilingHeightValue", "ceilingHeightUnit", "coveredType", "sideNetting",
            "netHeight", "boundaryType", "ventilation", "lighting", "lengthM", "widthM",
            "surfaceType", "turfQuality", "shockAbsorptionLayer",
            "cricketFormat", "cricketStumpsAvailable", "cricketBowlingMachine", "cricketPracticeMode",
            "pricePerSlot", "peakPricing", "discountMembership", "slotDurationMinutes",
            "bufferBetweenSlotsMinutes", "allowParallelBooking", "amenities", "rules",
            "createdAt", "updatedAt"
          ) VALUES (
            cid, r."tenantId", r."businessLocationId", r."name", r."arenaLabel", r."courtStatus",
            r."imageUrls", r."ceilingHeightValue", r."ceilingHeightUnit", r."coveredType", r."sideNetting",
            r."netHeight", r."boundaryType", r."ventilation", r."lighting", r."lengthM", r."widthM",
            r."surfaceType", r."turfQuality", r."shockAbsorptionLayer",
            r."cricketFormat", r."cricketStumpsAvailable", r."cricketBowlingMachine", r."cricketPracticeMode",
            r."cricketPricePerSlot", r."peakPricing", r."discountMembership", r."slotDurationMinutes",
            r."bufferBetweenSlotsMinutes", r."allowParallelBooking", r."amenities", r."rules",
            r."createdAt", r."updatedAt"
          );
        END LOOP;
      END $$
    `);

    const hasBlocks = await queryRunner.hasTable('court_slot_booking_blocks');
    if (hasBlocks) {
      await queryRunner.query(`
        INSERT INTO "court_slot_booking_blocks" (
          "tenantId", "courtKind", "courtId", "blockDate", "startTime"
        )
        SELECT
          b."tenantId",
          'cricket_court',
          m."cricketId",
          b."blockDate",
          b."startTime"
        FROM "court_slot_booking_blocks" b
        INNER JOIN "_turf_both_map" m ON b."courtId" = m."turfId" AND b."courtKind" = 'turf_court'
      `);

      await queryRunner.query(`
        UPDATE "court_slot_booking_blocks" b
        SET "courtKind" = 'futsal_court', "courtId" = m."futsalId"
        FROM "_turf_both_map" m
        WHERE b."courtKind" = 'turf_court' AND b."courtId" = m."turfId"
      `);

      await queryRunner.query(`
        UPDATE "court_slot_booking_blocks"
        SET "courtKind" = 'futsal_court'
        WHERE "courtKind" = 'turf_court'
          AND "courtId" IN (
            SELECT t."id" FROM "turf_courts" t
            WHERE t."supportsFutsal" = true AND COALESCE(t."supportsCricket", false) = false
          )
      `);

      await queryRunner.query(`
        UPDATE "court_slot_booking_blocks"
        SET "courtKind" = 'cricket_court'
        WHERE "courtKind" = 'turf_court'
          AND "courtId" IN (
            SELECT t."id" FROM "turf_courts" t
            WHERE t."supportsCricket" = true AND COALESCE(t."supportsFutsal", false) = false
          )
      `);
    }

    await queryRunner.query(`
      UPDATE "booking_items" bi
      SET "courtKind" = 'futsal_court', "courtId" = m."futsalId"
      FROM "_turf_both_map" m
      WHERE bi."courtKind" = 'turf_court'
        AND bi."courtId" = m."turfId"
        AND EXISTS (
          SELECT 1 FROM "bookings" bk
          WHERE bk."id" = bi."bookingId" AND bk."sportType" = 'futsal'
        )
    `);

    await queryRunner.query(`
      UPDATE "booking_items" bi
      SET "courtKind" = 'cricket_court', "courtId" = m."cricketId"
      FROM "_turf_both_map" m
      WHERE bi."courtKind" = 'turf_court'
        AND bi."courtId" = m."turfId"
        AND EXISTS (
          SELECT 1 FROM "bookings" bk
          WHERE bk."id" = bi."bookingId" AND bk."sportType" = 'cricket'
        )
    `);

    await queryRunner.query(`
      UPDATE "booking_items" bi
      SET "courtKind" = 'futsal_court'
      FROM "bookings" bk
      WHERE bi."courtKind" = 'turf_court'
        AND bi."bookingId" = bk."id"
        AND bk."sportType" = 'futsal'
        AND bi."courtId" IN (
          SELECT t."id" FROM "turf_courts" t
          WHERE t."supportsFutsal" = true AND COALESCE(t."supportsCricket", false) = false
        )
    `);

    await queryRunner.query(`
      UPDATE "booking_items" bi
      SET "courtKind" = 'cricket_court'
      FROM "bookings" bk
      WHERE bi."courtKind" = 'turf_court'
        AND bi."bookingId" = bk."id"
        AND bk."sportType" = 'cricket'
        AND bi."courtId" IN (
          SELECT t."id" FROM "turf_courts" t
          WHERE t."supportsCricket" = true AND COALESCE(t."supportsFutsal", false) = false
        )
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "_turf_both_map"`);

    await queryRunner.query(`
      DELETE FROM "booking_items" WHERE "courtKind" = 'turf_court'
    `);
    if (hasBlocks) {
      await queryRunner.query(`
        DELETE FROM "court_slot_booking_blocks" WHERE "courtKind" = 'turf_court'
      `);
    }

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "futsal_courts"
          ADD CONSTRAINT "fk_futsal_courts_business_location"
          FOREIGN KEY ("businessLocationId") REFERENCES "business_locations"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "cricket_courts"
          ADD CONSTRAINT "fk_cricket_courts_business_location"
          FOREIGN KEY ("businessLocationId") REFERENCES "business_locations"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_futsal_courts_tenant"
      ON "futsal_courts" ("tenantId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_futsal_courts_business_location"
      ON "futsal_courts" ("businessLocationId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cricket_courts_tenant"
      ON "cricket_courts" ("tenantId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cricket_courts_business_location"
      ON "cricket_courts" ("businessLocationId")
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "turf_courts"`);
  }

  /** Fresh DBs that never had turf_courts (migrations reordered) */
  private async createEmptySplitTables(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "futsal_courts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "businessLocationId" uuid,
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
        "futsalFormat" varchar(8),
        "futsalGoalPostsAvailable" boolean,
        "futsalGoalPostSize" varchar(80),
        "futsalLineMarkings" varchar(16),
        "pricePerSlot" decimal(12,2),
        "peakPricing" jsonb,
        "discountMembership" jsonb,
        "slotDurationMinutes" int,
        "bufferBetweenSlotsMinutes" int,
        "allowParallelBooking" boolean,
        "amenities" jsonb,
        "rules" jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_futsal_courts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cricket_courts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "businessLocationId" uuid,
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
        "cricketFormat" varchar(16),
        "cricketStumpsAvailable" boolean,
        "cricketBowlingMachine" boolean,
        "cricketPracticeMode" varchar(16),
        "pricePerSlot" decimal(12,2),
        "peakPricing" jsonb,
        "discountMembership" jsonb,
        "slotDurationMinutes" int,
        "bufferBetweenSlotsMinutes" int,
        "allowParallelBooking" boolean,
        "amenities" jsonb,
        "rules" jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cricket_courts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "futsal_courts"
          ADD CONSTRAINT "fk_futsal_courts_business_location"
          FOREIGN KEY ("businessLocationId") REFERENCES "business_locations"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "cricket_courts"
          ADD CONSTRAINT "fk_cricket_courts_business_location"
          FOREIGN KEY ("businessLocationId") REFERENCES "business_locations"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_futsal_courts_tenant" ON "futsal_courts" ("tenantId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_futsal_courts_business_location"
      ON "futsal_courts" ("businessLocationId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cricket_courts_tenant" ON "cricket_courts" ("tenantId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cricket_courts_business_location"
      ON "cricket_courts" ("businessLocationId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "futsal_courts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cricket_courts"`);
    // turf_courts cannot be restored automatically
  }
}
