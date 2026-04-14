import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CourtFacilitySlotsAllowBooked1711000000031 implements MigrationInterface {
  name = 'CourtFacilitySlotsAllowBooked1711000000031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "court_facility_slots"
      DROP CONSTRAINT IF EXISTS "CHK_court_facility_slots_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "court_facility_slots"
      ADD CONSTRAINT "CHK_court_facility_slots_status"
      CHECK ("status" IN ('available', 'blocked', 'booked'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "court_facility_slots"
      SET "status" = 'available'
      WHERE "status" = 'booked'
    `);
    await queryRunner.query(`
      ALTER TABLE "court_facility_slots"
      DROP CONSTRAINT IF EXISTS "CHK_court_facility_slots_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "court_facility_slots"
      ADD CONSTRAINT "CHK_court_facility_slots_status"
      CHECK ("status" IN ('available', 'blocked'))
    `);
  }
}
