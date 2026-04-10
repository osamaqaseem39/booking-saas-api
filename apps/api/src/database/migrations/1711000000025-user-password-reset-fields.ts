import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPasswordResetFields1711000000025 implements MigrationInterface {
  name = 'UserPasswordResetFields1711000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" varchar(64) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "passwordResetExpiresAt" TIMESTAMPTZ NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "passwordResetExpiresAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "passwordResetTokenHash"
    `);
  }
}
