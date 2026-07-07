import { MigrationInterface, QueryRunner } from 'typeorm';

export class FacilitySlotPricingPromo1711000000056
  implements MigrationInterface
{
  name = 'FacilitySlotPricingPromo1711000000056';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenant_time_slot_template_lines"
      ADD COLUMN IF NOT EXISTS "priceTier" varchar(16) NOT NULL DEFAULT 'standard'
    `);
    await queryRunner.query(`
      ALTER TABLE "court_facility_slots"
      ADD COLUMN IF NOT EXISTS "priceTier" varchar(16) NOT NULL DEFAULT 'standard'
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts"
      ADD COLUMN IF NOT EXISTS "timeSlotTemplateSchedule" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "turf_courts"
      ADD COLUMN IF NOT EXISTS "timeSlotTemplateSchedule" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "table_tennis_courts"
      ADD COLUMN IF NOT EXISTS "timeSlotTemplateSchedule" jsonb
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_promo_codes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "code" varchar(32) NOT NULL,
        "discountType" varchar(16) NOT NULL,
        "discountValue" decimal(12,2) NOT NULL,
        "minSubTotal" decimal(12,2),
        "validFrom" timestamptz,
        "validTo" timestamptz,
        "maxUses" int,
        "usedCount" int NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tenant_promo_codes_tenant_code" UNIQUE ("tenantId", "code")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "promoCodeId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "promoCode" varchar(32)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings" DROP COLUMN IF EXISTS "promoCode"
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" DROP COLUMN IF EXISTS "promoCodeId"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_promo_codes"`);
    await queryRunner.query(`
      ALTER TABLE "table_tennis_courts"
      DROP COLUMN IF EXISTS "timeSlotTemplateSchedule"
    `);
    await queryRunner.query(`
      ALTER TABLE "turf_courts"
      DROP COLUMN IF EXISTS "timeSlotTemplateSchedule"
    `);
    await queryRunner.query(`
      ALTER TABLE "padel_courts"
      DROP COLUMN IF EXISTS "timeSlotTemplateSchedule"
    `);
    await queryRunner.query(`
      ALTER TABLE "court_facility_slots"
      DROP COLUMN IF EXISTS "priceTier"
    `);
    await queryRunner.query(`
      ALTER TABLE "tenant_time_slot_template_lines"
      DROP COLUMN IF EXISTS "priceTier"
    `);
  }
}
