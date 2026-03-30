import { MigrationInterface, QueryRunner } from 'typeorm';

export class ArenaCourtsBusinessLocation1711000000008 implements MigrationInterface {
  name = 'ArenaCourtsBusinessLocation1711000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "turf_courts"
      ADD COLUMN IF NOT EXISTS "businessLocationId" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts"
      ADD COLUMN IF NOT EXISTS "businessLocationId" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "futsal_fields"
      ADD COLUMN IF NOT EXISTS "businessLocationId" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "cricket_indoor_courts"
      ADD COLUMN IF NOT EXISTS "businessLocationId" uuid NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "turf_courts"
          ADD CONSTRAINT "fk_turf_courts_business_location"
          FOREIGN KEY ("businessLocationId") REFERENCES "business_locations"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "padel_courts"
          ADD CONSTRAINT "fk_padel_courts_business_location"
          FOREIGN KEY ("businessLocationId") REFERENCES "business_locations"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "futsal_fields"
          ADD CONSTRAINT "fk_futsal_fields_business_location"
          FOREIGN KEY ("businessLocationId") REFERENCES "business_locations"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "cricket_indoor_courts"
          ADD CONSTRAINT "fk_cricket_indoor_business_location"
          FOREIGN KEY ("businessLocationId") REFERENCES "business_locations"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_turf_courts_business_location"
      ON "turf_courts" ("businessLocationId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_padel_courts_business_location"
      ON "padel_courts" ("businessLocationId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_futsal_fields_business_location"
      ON "futsal_fields" ("businessLocationId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cricket_indoor_business_location"
      ON "cricket_indoor_courts" ("businessLocationId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "turf_courts" DROP CONSTRAINT IF EXISTS "fk_turf_courts_business_location"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP CONSTRAINT IF EXISTS "fk_padel_courts_business_location"
    `);
    await queryRunner.query(`
      ALTER TABLE "futsal_fields" DROP CONSTRAINT IF EXISTS "fk_futsal_fields_business_location"
    `);
    await queryRunner.query(`
      ALTER TABLE "cricket_indoor_courts" DROP CONSTRAINT IF EXISTS "fk_cricket_indoor_business_location"
    `);
    await queryRunner.query(`
      ALTER TABLE "turf_courts" DROP COLUMN IF EXISTS "businessLocationId"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "businessLocationId"
    `);
    await queryRunner.query(`
      ALTER TABLE "futsal_fields" DROP COLUMN IF EXISTS "businessLocationId"
    `);
    await queryRunner.query(`
      ALTER TABLE "cricket_indoor_courts" DROP COLUMN IF EXISTS "businessLocationId"
    `);
  }
}
