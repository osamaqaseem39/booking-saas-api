import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantTimeSlotTemplateLines1711000000029 implements MigrationInterface {
  name = 'TenantTimeSlotTemplateLines1711000000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_time_slot_template_lines" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "templateId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "startTime" varchar(5) NOT NULL,
        "endTime" varchar(5) NOT NULL,
        "sortOrder" integer NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_time_slot_template_lines" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tenant_time_slot_template_lines_template_start" UNIQUE ("templateId", "startTime")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tenant_time_slot_template_lines_template"
      ON "tenant_time_slot_template_lines" ("templateId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tenant_time_slot_template_lines_tenant"
      ON "tenant_time_slot_template_lines" ("tenantId")
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "tenant_time_slot_template_lines"
        ADD CONSTRAINT "FK_tenant_time_slot_template_lines_template"
        FOREIGN KEY ("templateId") REFERENCES "tenant_time_slot_templates"("id")
        ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      INSERT INTO "tenant_time_slot_template_lines" (
        "templateId",
        "tenantId",
        "startTime",
        "endTime",
        "sortOrder"
      )
      SELECT
        t."id" AS "templateId",
        t."tenantId" AS "tenantId",
        slots."startTime" AS "startTime",
        LPAD((((slots."minutes" + 60) / 60) % 24)::text, 2, '0') || ':' ||
        LPAD(((slots."minutes" + 60) % 60)::text, 2, '0') AS "endTime",
        slots."ord"::int AS "sortOrder"
      FROM "tenant_time_slot_templates" t
      JOIN LATERAL (
        SELECT
          value AS "startTime",
          ord,
          (split_part(value, ':', 1)::int * 60 + split_part(value, ':', 2)::int) AS "minutes"
        FROM jsonb_array_elements_text(COALESCE(t."slotStarts", '[]'::jsonb)) WITH ORDINALITY AS j(value, ord)
      ) AS slots ON true
      ON CONFLICT ("templateId", "startTime") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenant_time_slot_template_lines"
      DROP CONSTRAINT IF EXISTS "FK_tenant_time_slot_template_lines_template"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_time_slot_template_lines"`);
  }
}
