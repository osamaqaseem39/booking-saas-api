import { MigrationInterface, QueryRunner } from 'typeorm';

export class BusinessLocationFacilityTypes1711000000007 implements MigrationInterface {
  name = 'BusinessLocationFacilityTypes1711000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ADD COLUMN IF NOT EXISTS "facilityTypes" text[] NOT NULL DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business_locations" DROP COLUMN IF EXISTS "facilityTypes"
    `);
  }
}
