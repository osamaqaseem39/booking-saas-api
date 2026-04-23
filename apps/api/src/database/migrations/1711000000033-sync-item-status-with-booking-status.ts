import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncItemStatusWithBookingStatus1711000000033
  implements MigrationInterface
{
  name = 'SyncItemStatusWithBookingStatus1711000000033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Sync itemStatus with bookingStatus for all existing records to satisfy the unique index
    await queryRunner.query(`
      UPDATE "booking_items" bi
      SET "itemStatus" = 'cancelled'
      FROM "bookings" b
      WHERE b."id" = bi."bookingId"
        AND b."bookingStatus" IN ('cancelled', 'no_show')
        AND bi."itemStatus" <> 'cancelled'
    `);

    await queryRunner.query(`
      UPDATE "booking_items" bi
      SET "itemStatus" = 'reserved'
      FROM "bookings" b
      WHERE b."id" = bi."bookingId"
        AND b."bookingStatus" = 'pending'
        AND bi."itemStatus" <> 'reserved'
    `);

    await queryRunner.query(`
      UPDATE "booking_items" bi
      SET "itemStatus" = 'confirmed'
      FROM "bookings" b
      WHERE b."id" = bi."bookingId"
        AND b."bookingStatus" IN ('confirmed', 'completed')
        AND bi."itemStatus" <> 'confirmed'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No easy way to rollback without losing original states, 
    // but these states should have been in sync anyway.
  }
}
