import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Re-align booking_items with cancelled / no_show bookings. A prior app bug
 * could leave items as confirmed after PATCH cancelled (cascade save overwrote
 * a raw SQL update). The partial unique index then blocked re-booking the slot.
 */
export class BookingItemsAlignCancelledBookings1711000000035
  implements MigrationInterface
{
  name = 'BookingItemsAlignCancelledBookings1711000000035';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "booking_items" bi
      SET "itemStatus" = 'cancelled'
      FROM "bookings" b
      WHERE b."id" = bi."bookingId"
        AND b."bookingStatus" IN ('cancelled', 'no_show')
        AND bi."itemStatus" <> 'cancelled'
    `);
  }

  public async down(): Promise<void> {
    // Data fix only
  }
}
