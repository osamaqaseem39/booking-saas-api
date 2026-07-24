import { MigrationInterface, QueryRunner } from 'typeorm';

export class BookingPaymentProofUrl1711000000062 implements MigrationInterface {
  name = 'BookingPaymentProofUrl1711000000062';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "paymentProofUrl" varchar(500)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings" DROP COLUMN IF EXISTS "paymentProofUrl"
    `);
  }
}
