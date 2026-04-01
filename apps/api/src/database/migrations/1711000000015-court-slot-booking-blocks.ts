import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CourtSlotBookingBlocks1711000000015 implements MigrationInterface {
  name = 'CourtSlotBookingBlocks1711000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "court_slot_booking_blocks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "courtKind" varchar(32) NOT NULL,
        "courtId" uuid NOT NULL,
        "blockDate" date NOT NULL,
        "startTime" varchar(5) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_court_slot_booking_blocks" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_court_slot_booking_blocks_slot" UNIQUE ("tenantId", "courtKind", "courtId", "blockDate", "startTime")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_court_slot_booking_blocks_lookup"
      ON "court_slot_booking_blocks" ("tenantId", "courtKind", "courtId", "blockDate")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "court_slot_booking_blocks"`);
  }
}
