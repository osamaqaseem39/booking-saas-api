import { MigrationInterface, QueryRunner } from 'typeorm';

export class TurfCourtSportMode1711000000003 implements MigrationInterface {
  name = 'TurfCourtSportMode1711000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "turf_courts" ADD COLUMN IF NOT EXISTS "sportMode" varchar(16) NOT NULL DEFAULT 'both'
    `);
    await queryRunner.query(`
      UPDATE "turf_courts" SET "sportMode" = CASE
        WHEN "supportsFutsal" = true AND "supportsCricket" = true THEN 'both'
        WHEN "supportsFutsal" = true AND "supportsCricket" = false THEN 'futsal_only'
        WHEN "supportsFutsal" = false AND "supportsCricket" = true THEN 'cricket_only'
        ELSE 'both'
      END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "turf_courts" DROP COLUMN IF EXISTS "sportMode"
    `);
  }
}
