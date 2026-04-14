import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Safety migration for environments that may have skipped older startup paths.
 * Keeps schema alignment explicit in migration history.
 */
export class BusinessLocationDetailsBackfillSafe1711000000026 implements MigrationInterface {
  name = 'BusinessLocationDetailsBackfillSafe1711000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ADD COLUMN IF NOT EXISTS "details" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_locations" DROP COLUMN IF EXISTS "details"`,
    );
  }
}
