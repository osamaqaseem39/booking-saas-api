import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Removes unused `businesses.businessType` column (product no longer stores this field). */
export class DropBusinessType1711000000022 implements MigrationInterface {
  name = 'DropBusinessType1711000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN IF EXISTS "businessType"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "businesses"
      ADD COLUMN IF NOT EXISTS "businessType" varchar(40)
    `);
  }
}
