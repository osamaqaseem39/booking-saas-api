import { MigrationInterface, QueryRunner } from 'typeorm';

export class Bookings1711000000004 implements MigrationInterface {
  name = 'Bookings1711000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bookings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "sportType" varchar(16) NOT NULL,
        "bookingDate" date NOT NULL,
        "subTotal" decimal(12,2) NOT NULL,
        "discount" decimal(12,2) NOT NULL DEFAULT 0,
        "tax" decimal(12,2) NOT NULL DEFAULT 0,
        "totalAmount" decimal(12,2) NOT NULL,
        "paymentStatus" varchar(16) NOT NULL,
        "paymentMethod" varchar(16) NOT NULL,
        "transactionId" varchar(120),
        "paidAt" TIMESTAMPTZ,
        "bookingStatus" varchar(20) NOT NULL,
        "notes" text,
        "cancellationReason" text,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_bookings_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_tenant" ON "bookings" ("tenantId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_user" ON "bookings" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_date" ON "bookings" ("bookingDate")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "booking_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "bookingId" uuid NOT NULL,
        "courtKind" varchar(32) NOT NULL,
        "courtId" uuid NOT NULL,
        "slotId" varchar(120),
        "startTime" varchar(5) NOT NULL,
        "endTime" varchar(5) NOT NULL,
        "price" decimal(12,2) NOT NULL,
        "currency" varchar(8) NOT NULL DEFAULT 'PKR',
        "itemStatus" varchar(20) NOT NULL,
        CONSTRAINT "fk_booking_items_booking" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_booking_items_booking" ON "booking_items" ("bookingId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "booking_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bookings"`);
  }
}
