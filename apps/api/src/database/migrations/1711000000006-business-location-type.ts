import { MigrationInterface, QueryRunner } from 'typeorm';

export class BusinessLocationType1711000000006 implements MigrationInterface {
  name = 'BusinessLocationType1711000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ADD COLUMN IF NOT EXISTS "locationType" varchar(80) NOT NULL DEFAULT 'other'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business_locations" DROP COLUMN IF EXISTS "locationType"
    `);
  }
}
