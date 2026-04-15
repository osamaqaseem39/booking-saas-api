import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-facility calendar slots (30-minute segments) for a given date.
 * Used by the dashboard facility-slots form; `status` blocks merge with slot-grid booking rules.
 */
export class CourtFacilitySlots1711000000027 implements MigrationInterface {
  name = 'CourtFacilitySlots1711000000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "court_facility_slots" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "courtKind" varchar(32) NOT NULL,
        "courtId" uuid NOT NULL,
        "slotDate" date NOT NULL,
        "startTime" varchar(5) NOT NULL,
        "endTime" varchar(5) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'available',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_court_facility_slots" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_court_facility_slots_key" UNIQUE ("tenantId", "courtKind", "courtId", "slotDate", "startTime"),
        CONSTRAINT "CHK_court_facility_slots_status" CHECK ("status" IN ('available', 'blocked'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_court_facility_slots_lookup"
      ON "court_facility_slots" ("tenantId", "courtKind", "courtId", "slotDate")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "court_facility_slots"`);
  }
}
