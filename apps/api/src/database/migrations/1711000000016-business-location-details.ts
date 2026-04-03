import { MigrationInterface, QueryRunner } from 'typeorm';

export class BusinessLocationDetails1711000000016 implements MigrationInterface {
  name = 'BusinessLocationDetails1711000000016';

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
