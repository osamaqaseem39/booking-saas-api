import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditEvents1711000000036 implements MigrationInterface {
  name = 'AuditEvents1711000000036';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "method" varchar(12) NOT NULL,
        "path" text NOT NULL,
        "normalizedPath" text NOT NULL,
        "statusCode" int NOT NULL,
        "durationMs" int NOT NULL,
        "tenantId" varchar(64),
        "userId" uuid,
        "ip" varchar(64),
        "userAgent" text,
        "requestBody" jsonb,
        "query" jsonb,
        "errorMessage" text
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_audit_events_occurred"
      ON "audit_events" ("occurredAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_audit_events_tenant"
      ON "audit_events" ("tenantId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_audit_events_user"
      ON "audit_events" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_events"`);
  }
}
