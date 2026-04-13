import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds nullable password-reset token columns on `users` (see `User` entity). Run on deploy (`migrationsRun` / `npm run migration:run`). */
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
