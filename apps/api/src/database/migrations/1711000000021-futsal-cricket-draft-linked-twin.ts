import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds optional futsal↔cricket "twin" link so one physical turf shares booking availability.
 * Draft court status for facilities not yet published to booking.
 */
export class FutsalCricketDraftLinkedTwin1711000000021 implements MigrationInterface {
  name = 'FutsalCricketDraftLinkedTwin1711000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "futsal_courts"
      ADD COLUMN IF NOT EXISTS "linkedTwinCourtKind" varchar(32),
      ADD COLUMN IF NOT EXISTS "linkedTwinCourtId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "cricket_courts"
      ADD COLUMN IF NOT EXISTS "linkedTwinCourtKind" varchar(32),
      ADD COLUMN IF NOT EXISTS "linkedTwinCourtId" uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "futsal_courts"
      DROP COLUMN IF EXISTS "linkedTwinCourtKind",
      DROP COLUMN IF EXISTS "linkedTwinCourtId"
    `);
    await queryRunner.query(`
      ALTER TABLE "cricket_courts"
      DROP COLUMN IF EXISTS "linkedTwinCourtKind",
      DROP COLUMN IF EXISTS "linkedTwinCourtId"
    `);
  }
}
