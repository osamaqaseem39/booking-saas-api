import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropBusinessVertical1711000000007 implements MigrationInterface {
  name = 'DropBusinessVertical1711000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "businesses" DROP COLUMN IF EXISTS "vertical"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "businesses"
      ADD COLUMN IF NOT EXISTS "vertical" varchar(80) NOT NULL DEFAULT 'arena'
    `);
  }
}
