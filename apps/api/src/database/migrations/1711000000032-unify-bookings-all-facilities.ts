import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnifyBookingsAllFacilities1711000000032
  implements MigrationInterface
{
  name = 'UnifyBookingsAllFacilities1711000000032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "booking_items"
      ADD COLUMN IF NOT EXISTS "startDatetime" TIMESTAMPTZ
    `);
    await queryRunner.query(`
      ALTER TABLE "booking_items"
      ADD COLUMN IF NOT EXISTS "endDatetime" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      UPDATE "booking_items" bi
      SET
        "startDatetime" = (b."bookingDate"::text || 'T' || bi."startTime" || ':00Z')::timestamptz,
        "endDatetime" = (
          (
            CASE
              WHEN bi."endTime" <= bi."startTime" THEN (b."bookingDate" + INTERVAL '1 day')::date
              ELSE b."bookingDate"
            END
          )::text
          || 'T'
          || bi."endTime"
          || ':00Z'
        )::timestamptz
      FROM "bookings" b
      WHERE b."id" = bi."bookingId"
        AND (bi."startDatetime" IS NULL OR bi."endDatetime" IS NULL)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_booking_items_court_start_datetime"
      ON "booking_items" ("courtKind", "courtId", "startDatetime")
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "courtKind", "courtId", "startDatetime"
            ORDER BY "id" DESC
          ) AS rn
        FROM "booking_items"
        WHERE "itemStatus" <> 'cancelled'
      )
      UPDATE "booking_items" bi
      SET "itemStatus" = 'cancelled'
      FROM ranked r
      WHERE bi."id" = r."id" AND r.rn > 1
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_booking_items_court_start_datetime_active"
      ON "booking_items" ("courtKind", "courtId", "startDatetime")
      WHERE "itemStatus" <> 'cancelled'
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "turf_bookings"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_booking_items_court_start_datetime_active"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_booking_items_court_start_datetime"
    `);
    await queryRunner.query(`
      ALTER TABLE "booking_items" DROP COLUMN IF EXISTS "endDatetime"
    `);
    await queryRunner.query(`
      ALTER TABLE "booking_items" DROP COLUMN IF EXISTS "startDatetime"
    `);
  }
}
