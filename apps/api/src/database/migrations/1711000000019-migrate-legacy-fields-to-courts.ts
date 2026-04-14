import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moves legacy `futsal_fields` / `cricket_indoor_courts` into `futsal_courts` /
 * `cricket_courts` (same UUIDs), remaps booking references, then drops legacy tables.
 */
export class MigrateLegacyFieldsToCourts1711000000019 implements MigrationInterface {
  name = 'MigrateLegacyFieldsToCourts1711000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasFf = await queryRunner.hasTable('futsal_fields');
    const hasFc = await queryRunner.hasTable('futsal_courts');
    if (hasFf && hasFc) {
      await queryRunner.query(`
        INSERT INTO "futsal_courts" (
          "id", "tenantId", "businessLocationId", "name", "courtStatus",
          "createdAt", "updatedAt"
        )
        SELECT
          f."id",
          f."tenantId",
          f."businessLocationId",
          f."name",
          CASE WHEN f."isActive" THEN 'active' ELSE 'maintenance' END,
          f."createdAt",
          f."updatedAt"
        FROM "futsal_fields" f
        WHERE NOT EXISTS (SELECT 1 FROM "futsal_courts" c WHERE c."id" = f."id")
      `);
    }

    const hasCi = await queryRunner.hasTable('cricket_indoor_courts');
    const hasCc = await queryRunner.hasTable('cricket_courts');
    if (hasCi && hasCc) {
      await queryRunner.query(`
        INSERT INTO "cricket_courts" (
          "id", "tenantId", "businessLocationId", "name", "courtStatus",
          "createdAt", "updatedAt"
        )
        SELECT
          c."id",
          c."tenantId",
          c."businessLocationId",
          c."name",
          CASE WHEN c."isActive" THEN 'active' ELSE 'maintenance' END,
          c."createdAt",
          c."updatedAt"
        FROM "cricket_indoor_courts" c
        WHERE NOT EXISTS (SELECT 1 FROM "cricket_courts" x WHERE x."id" = c."id")
      `);
    }

    const hasBi = await queryRunner.hasTable('booking_items');
    if (hasBi) {
      await queryRunner.query(`
        UPDATE "booking_items" SET "courtKind" = 'futsal_court'
        WHERE "courtKind" = 'futsal_field'
      `);
      await queryRunner.query(`
        UPDATE "booking_items" SET "courtKind" = 'cricket_court'
        WHERE "courtKind" = 'cricket_indoor_court'
      `);
    }

    const hasBlk = await queryRunner.hasTable('court_slot_booking_blocks');
    if (hasBlk) {
      await queryRunner.query(`
        UPDATE "court_slot_booking_blocks" SET "courtKind" = 'futsal_court'
        WHERE "courtKind" = 'futsal_field'
      `);
      await queryRunner.query(`
        UPDATE "court_slot_booking_blocks" SET "courtKind" = 'cricket_court'
        WHERE "courtKind" = 'cricket_indoor_court'
      `);
    }

    if (hasFf) {
      await queryRunner.query(`
        ALTER TABLE "futsal_fields" DROP CONSTRAINT IF EXISTS "fk_futsal_fields_business_location"
      `);
      await queryRunner.query(`DROP TABLE IF EXISTS "futsal_fields"`);
    }
    if (hasCi) {
      await queryRunner.query(`
        ALTER TABLE "cricket_indoor_courts" DROP CONSTRAINT IF EXISTS "fk_cricket_indoor_business_location"
      `);
      await queryRunner.query(`DROP TABLE IF EXISTS "cricket_indoor_courts"`);
    }
  }

  public async down(): Promise<void> {
    // Legacy tables not recreated
  }
}
