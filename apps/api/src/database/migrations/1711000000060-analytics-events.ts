import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnalyticsEvents1711000000060 implements MigrationInterface {
  name = 'AnalyticsEvents1711000000060';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "analytics_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventId" varchar(64) NOT NULL,
        "eventName" varchar(64) NOT NULL,
        "occurredAt" TIMESTAMPTZ NOT NULL,
        "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "userId" uuid,
        "tenantId" uuid NOT NULL,
        "locationId" uuid,
        "sessionId" varchar(64),
        "screenName" varchar(100),
        "platform" varchar(16),
        "appVersion" varchar(32),
        "appBuild" varchar(32),
        "sourceIpHash" varchar(64),
        "userAgent" varchar(400),
        "properties" jsonb NOT NULL DEFAULT '{}',
        "schemaVersion" smallint NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_analytics_events_event_id"
      ON "analytics_events" ("eventId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_analytics_events_tenant_occurred"
      ON "analytics_events" ("tenantId", "occurredAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_analytics_events_name_occurred"
      ON "analytics_events" ("eventName", "occurredAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_analytics_events_location_occurred"
      ON "analytics_events" ("locationId", "occurredAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_analytics_events_user_occurred"
      ON "analytics_events" ("userId", "occurredAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "analytics_events"`);
  }
}
