import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnalyticsEventsSpecColumns1711000000061 implements MigrationInterface {
  name = 'AnalyticsEventsSpecColumns1711000000061';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "analytics_events"
      ADD COLUMN IF NOT EXISTS "anonymousId" varchar(100)
    `);
    await queryRunner.query(`
      ALTER TABLE "analytics_events"
      ADD COLUMN IF NOT EXISTS "context" jsonb NOT NULL DEFAULT '{}'
    `);
    await queryRunner.query(`
      ALTER TABLE "analytics_events"
      ADD COLUMN IF NOT EXISTS "source" varchar(16) NOT NULL DEFAULT 'mobile_client'
    `);
    await queryRunner.query(`
      ALTER TABLE "analytics_events"
      ALTER COLUMN "tenantId" DROP NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_analytics_events_anonymous_occurred"
      ON "analytics_events" ("anonymousId", "occurredAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_analytics_events_session"
      ON "analytics_events" ("sessionId", "occurredAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_analytics_events_session"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_analytics_events_anonymous_occurred"`,
    );
    await queryRunner.query(`ALTER TABLE "analytics_events" DROP COLUMN IF EXISTS "source"`);
    await queryRunner.query(`ALTER TABLE "analytics_events" DROP COLUMN IF EXISTS "context"`);
    await queryRunner.query(
      `ALTER TABLE "analytics_events" DROP COLUMN IF EXISTS "anonymousId"`,
    );
  }
}
