import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantTimeSlotTemplateLineStatus1711000000030
  implements MigrationInterface
{
  name = 'TenantTimeSlotTemplateLineStatus1711000000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenant_time_slot_template_lines"
      ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'available'
    `);
    await queryRunner.query(`
      UPDATE "tenant_time_slot_template_lines"
      SET "status" = 'available'
      WHERE "status" IS NULL OR "status" = ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenant_time_slot_template_lines"
      DROP COLUMN IF EXISTS "status"
    `);
  }
}
