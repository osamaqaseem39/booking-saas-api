import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropBusinessLocationBranchArenaIds1711000000013
  implements MigrationInterface
{
  name = 'DropBusinessLocationBranchArenaIds1711000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_locations" DROP COLUMN IF EXISTS "arenaId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_locations" DROP COLUMN IF EXISTS "branchId"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ADD COLUMN IF NOT EXISTS "branchId" varchar(80)
    `);
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ADD COLUMN IF NOT EXISTS "arenaId" varchar(80)
    `);
  }
}
