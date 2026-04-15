import { MigrationInterface, QueryRunner } from 'typeorm';

export class TurfTimeSlotTemplateId1711000000032 implements MigrationInterface {
  name = 'TurfTimeSlotTemplateId1711000000032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "turf_courts"
      ADD COLUMN IF NOT EXISTS "timeSlotTemplateId" uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "turf_courts"
      DROP COLUMN IF EXISTS "timeSlotTemplateId"
    `);
  }
}
