import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailOtps1711000000055 implements MigrationInterface {
  name = 'EmailOtps1711000000055';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_otps" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" varchar(320) NOT NULL,
        "purpose" varchar(20) NOT NULL,
        "codeHash" varchar(64) NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "attempts" int NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_otps" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_otps_email_purpose"
      ON "email_otps" ("email", "purpose")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_email_otps_email_purpose"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_otps"`);
  }
}
