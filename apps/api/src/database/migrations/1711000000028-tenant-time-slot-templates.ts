import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Named 30-minute slot-start templates per tenant; optional FK on arena courts.
 */
export class TenantTimeSlotTemplates1711000000028 implements MigrationInterface {
  name = 'TenantTimeSlotTemplates1711000000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_time_slot_templates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "slotStarts" jsonb NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_time_slot_templates" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tenant_time_slot_templates_tenant"
      ON "tenant_time_slot_templates" ("tenantId")
    `);

    await queryRunner.query(`
      ALTER TABLE "futsal_courts"
      ADD COLUMN IF NOT EXISTS "timeSlotTemplateId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "cricket_courts"
      ADD COLUMN IF NOT EXISTS "timeSlotTemplateId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts"
      ADD COLUMN IF NOT EXISTS "timeSlotTemplateId" uuid
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "futsal_courts"
        ADD CONSTRAINT "FK_futsal_courts_time_slot_template"
        FOREIGN KEY ("timeSlotTemplateId") REFERENCES "tenant_time_slot_templates"("id")
        ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "cricket_courts"
        ADD CONSTRAINT "FK_cricket_courts_time_slot_template"
        FOREIGN KEY ("timeSlotTemplateId") REFERENCES "tenant_time_slot_templates"("id")
        ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "padel_courts"
        ADD CONSTRAINT "FK_padel_courts_time_slot_template"
        FOREIGN KEY ("timeSlotTemplateId") REFERENCES "tenant_time_slot_templates"("id")
        ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP CONSTRAINT IF EXISTS "FK_padel_courts_time_slot_template"
    `);
    await queryRunner.query(`
      ALTER TABLE "cricket_courts" DROP CONSTRAINT IF EXISTS "FK_cricket_courts_time_slot_template"
    `);
    await queryRunner.query(`
      ALTER TABLE "futsal_courts" DROP CONSTRAINT IF EXISTS "FK_futsal_courts_time_slot_template"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts" DROP COLUMN IF EXISTS "timeSlotTemplateId"
    `);
    await queryRunner.query(`
      ALTER TABLE "cricket_courts" DROP COLUMN IF EXISTS "timeSlotTemplateId"
    `);
    await queryRunner.query(`
      ALTER TABLE "futsal_courts" DROP COLUMN IF EXISTS "timeSlotTemplateId"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_time_slot_templates"`);
  }
}
