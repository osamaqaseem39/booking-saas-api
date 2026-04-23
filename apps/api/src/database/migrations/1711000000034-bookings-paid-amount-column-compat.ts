import { MigrationInterface, QueryRunner } from 'typeorm';

export class BookingsPaidAmountColumnCompat1711000000034
  implements MigrationInterface
{
  name = 'BookingsPaidAmountColumnCompat1711000000034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'bookings'
            AND column_name = 'paidAmount'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'bookings'
            AND column_name = 'paid_amount'
        ) THEN
          ALTER TABLE "bookings" RENAME COLUMN "paidAmount" TO "paid_amount";
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'bookings'
            AND column_name = 'paid_amount'
        ) THEN
          ALTER TABLE "bookings"
            ADD COLUMN "paid_amount" decimal(12,2) NOT NULL DEFAULT 0;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'bookings'
            AND column_name = 'paid_amount'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'bookings'
            AND column_name = 'paidAmount'
        ) THEN
          ALTER TABLE "bookings" RENAME COLUMN "paid_amount" TO "paidAmount";
        END IF;
      END
      $$;
    `);
  }
}
