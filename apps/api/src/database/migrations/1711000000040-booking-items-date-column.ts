import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Stores explicit service date per booking item (useful for overnight split rows). */
export class BookingItemsDateColumn1711000000040 implements MigrationInterface {
  name = 'BookingItemsDateColumn1711000000040';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "booking_items"
      ADD COLUMN IF NOT EXISTS "date" date
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "booking_items"
      DROP COLUMN IF EXISTS "date"
    `);
  }
}
