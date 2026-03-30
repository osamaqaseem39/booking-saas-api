import { MigrationInterface, QueryRunner } from 'typeorm';

export class BusinessLocationBranchProfile1711000000010
  implements MigrationInterface
{
  name = 'BusinessLocationBranchProfile1711000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ADD COLUMN IF NOT EXISTS "area" varchar(120)
    `);
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ADD COLUMN IF NOT EXISTS "country" varchar(120)
    `);
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ADD COLUMN IF NOT EXISTS "latitude" decimal(10,6)
    `);
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ADD COLUMN IF NOT EXISTS "longitude" decimal(10,6)
    `);
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ADD COLUMN IF NOT EXISTS "manager" varchar(120)
    `);
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ADD COLUMN IF NOT EXISTS "workingHours" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ADD COLUMN IF NOT EXISTS "timezone" varchar(80)
    `);
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ADD COLUMN IF NOT EXISTS "currency" varchar(8) NOT NULL DEFAULT 'PKR'
    `);
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'active'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_locations" DROP COLUMN IF EXISTS "status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_locations" DROP COLUMN IF EXISTS "currency"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_locations" DROP COLUMN IF EXISTS "timezone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_locations" DROP COLUMN IF EXISTS "workingHours"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_locations" DROP COLUMN IF EXISTS "manager"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_locations" DROP COLUMN IF EXISTS "longitude"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_locations" DROP COLUMN IF EXISTS "latitude"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_locations" DROP COLUMN IF EXISTS "country"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_locations" DROP COLUMN IF EXISTS "area"`,
    );
  }
}
