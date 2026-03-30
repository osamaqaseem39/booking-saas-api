import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordHashToUsers1711000000009 implements MigrationInterface {
  name = 'AddPasswordHashToUsers1711000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "passwordHash" varchar(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "passwordHash"
    `);
  }
}
