import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One `futsal_courts` row can represent a dual-sport turf (futsal + cricket) without a
 * separate `cricket_courts` row or twin link.
 */
export class FutsalCourtDualCricket1711000000031 implements MigrationInterface {
  name = 'FutsalCourtDualCricket1711000000031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "futsal_courts"
      ADD COLUMN IF NOT EXISTS "supportsCricket" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "futsal_courts"
      ADD COLUMN IF NOT EXISTS "cricketFormat" varchar(16)
    `);
    await queryRunner.query(`
      ALTER TABLE "futsal_courts"
      ADD COLUMN IF NOT EXISTS "cricketStumpsAvailable" boolean
    `);
    await queryRunner.query(`
      ALTER TABLE "futsal_courts"
      ADD COLUMN IF NOT EXISTS "cricketBowlingMachine" boolean
    `);
    await queryRunner.query(`
      ALTER TABLE "futsal_courts"
      ADD COLUMN IF NOT EXISTS "cricketPracticeMode" varchar(16)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "futsal_courts" DROP COLUMN IF EXISTS "cricketPracticeMode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "futsal_courts" DROP COLUMN IF EXISTS "cricketBowlingMachine"`,
    );
    await queryRunner.query(
      `ALTER TABLE "futsal_courts" DROP COLUMN IF EXISTS "cricketStumpsAvailable"`,
    );
    await queryRunner.query(
      `ALTER TABLE "futsal_courts" DROP COLUMN IF EXISTS "cricketFormat"`,
    );
    await queryRunner.query(
      `ALTER TABLE "futsal_courts" DROP COLUMN IF EXISTS "supportsCricket"`,
    );
  }
}
