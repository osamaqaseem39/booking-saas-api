import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bookable table tennis assets + extend DB court ref triggers to `table_tennis_court`.
 */
export class TableTennisCourtsAndCourtFk1711000000038
  implements MigrationInterface
{
  name = 'TableTennisCourtsAndCourtFk1711000000038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "table_tennis_courts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "businessLocationId" uuid,
        "name" varchar(160) NOT NULL,
        "courtStatus" varchar(20) NOT NULL DEFAULT 'active',
        "description" text,
        "imageUrls" jsonb,
        "pricePerSlot" decimal(12,2),
        "slotDurationMinutes" int,
        "bufferBetweenSlotsMinutes" int,
        "timeSlotTemplateId" uuid,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_table_tennis_courts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_table_tennis_courts_businessLocationId"
      ON "table_tennis_courts" ("businessLocationId")
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION booking_items_enforce_court_ref()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $f$
      DECLARE
        v_tenant_id uuid;
      BEGIN
        SELECT b."tenantId" INTO v_tenant_id
        FROM "bookings" b
        WHERE b."id" = NEW."bookingId";

        IF v_tenant_id IS NULL THEN
          RAISE EXCEPTION 'booking not found: %', NEW."bookingId"
            USING ERRCODE = '23503';
        END IF;

        IF NEW."courtKind" = 'padel_court' THEN
          IF to_regclass('public.padel_courts') IS NULL THEN
            RAISE EXCEPTION 'padel_courts is not available'
              USING ERRCODE = '42P01';
          END IF;
          IF NOT EXISTS (
            SELECT 1
            FROM "padel_courts" c
            WHERE c."id" = NEW."courtId"
              AND c."tenantId" = v_tenant_id
          ) THEN
            RAISE EXCEPTION 'padel_court not found for tenant: % (courtId=%)', v_tenant_id, NEW."courtId"
              USING ERRCODE = '23503';
          END IF;
        ELSIF NEW."courtKind" = 'turf_court' THEN
          IF to_regclass('public.turf_courts') IS NULL THEN
            RAISE EXCEPTION 'turf_courts is not available'
              USING ERRCODE = '42P01';
          END IF;
          IF NOT EXISTS (
            SELECT 1
            FROM "turf_courts" c
            WHERE c."id" = NEW."courtId"
              AND c."tenantId" = v_tenant_id
          ) THEN
            RAISE EXCEPTION 'turf_court not found for tenant: % (courtId=%)', v_tenant_id, NEW."courtId"
              USING ERRCODE = '23503';
          END IF;
        ELSIF NEW."courtKind" = 'table_tennis_court' THEN
          IF to_regclass('public.table_tennis_courts') IS NULL THEN
            RAISE EXCEPTION 'table_tennis_courts is not available'
              USING ERRCODE = '42P01';
          END IF;
          IF NOT EXISTS (
            SELECT 1
            FROM "table_tennis_courts" c
            WHERE c."id" = NEW."courtId"
              AND c."tenantId" = v_tenant_id
          ) THEN
            RAISE EXCEPTION 'table_tennis_court not found for tenant: % (courtId=%)', v_tenant_id, NEW."courtId"
              USING ERRCODE = '23503';
          END IF;
        ELSE
          RAISE EXCEPTION 'unsupported courtKind: %', NEW."courtKind"
            USING ERRCODE = '23514';
        END IF;

        RETURN NEW;
      END
      $f$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION court_facility_slots_enforce_court_ref()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $f$
      BEGIN
        IF NEW."courtKind" = 'padel_court' THEN
          IF to_regclass('public.padel_courts') IS NULL THEN
            RAISE EXCEPTION 'padel_courts is not available'
              USING ERRCODE = '42P01';
          END IF;
          IF NOT EXISTS (
            SELECT 1
            FROM "padel_courts" c
            WHERE c."id" = NEW."courtId"
              AND c."tenantId" = NEW."tenantId"
          ) THEN
            RAISE EXCEPTION 'padel_court not found for tenant: % (courtId=%)', NEW."tenantId", NEW."courtId"
              USING ERRCODE = '23503';
          END IF;
        ELSIF NEW."courtKind" = 'turf_court' THEN
          IF to_regclass('public.turf_courts') IS NULL THEN
            RAISE EXCEPTION 'turf_courts is not available'
              USING ERRCODE = '42P01';
          END IF;
          IF NOT EXISTS (
            SELECT 1
            FROM "turf_courts" c
            WHERE c."id" = NEW."courtId"
              AND c."tenantId" = NEW."tenantId"
          ) THEN
            RAISE EXCEPTION 'turf_court not found for tenant: % (courtId=%)', NEW."tenantId", NEW."courtId"
              USING ERRCODE = '23503';
          END IF;
        ELSIF NEW."courtKind" = 'table_tennis_court' THEN
          IF to_regclass('public.table_tennis_courts') IS NULL THEN
            RAISE EXCEPTION 'table_tennis_courts is not available'
              USING ERRCODE = '42P01';
          END IF;
          IF NOT EXISTS (
            SELECT 1
            FROM "table_tennis_courts" c
            WHERE c."id" = NEW."courtId"
              AND c."tenantId" = NEW."tenantId"
          ) THEN
            RAISE EXCEPTION 'table_tennis_court not found for tenant: % (courtId=%)', NEW."tenantId", NEW."courtId"
              USING ERRCODE = '23503';
          END IF;
        ELSE
          RAISE EXCEPTION 'unsupported courtKind: %', NEW."courtKind"
            USING ERRCODE = '23514';
        END IF;

        RETURN NEW;
      END
      $f$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION court_slot_booking_blocks_enforce_court_ref()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $f$
      BEGIN
        IF NEW."courtKind" = 'padel_court' THEN
          IF to_regclass('public.padel_courts') IS NULL THEN
            RAISE EXCEPTION 'padel_courts is not available'
              USING ERRCODE = '42P01';
          END IF;
          IF NOT EXISTS (
            SELECT 1
            FROM "padel_courts" c
            WHERE c."id" = NEW."courtId"
              AND c."tenantId" = NEW."tenantId"
          ) THEN
            RAISE EXCEPTION 'padel_court not found for tenant: % (courtId=%)', NEW."tenantId", NEW."courtId"
              USING ERRCODE = '23503';
          END IF;
        ELSIF NEW."courtKind" = 'turf_court' THEN
          IF to_regclass('public.turf_courts') IS NULL THEN
            RAISE EXCEPTION 'turf_courts is not available'
              USING ERRCODE = '42P01';
          END IF;
          IF NOT EXISTS (
            SELECT 1
            FROM "turf_courts" c
            WHERE c."id" = NEW."courtId"
              AND c."tenantId" = NEW."tenantId"
          ) THEN
            RAISE EXCEPTION 'turf_court not found for tenant: % (courtId=%)', NEW."tenantId", NEW."courtId"
              USING ERRCODE = '23503';
          END IF;
        ELSIF NEW."courtKind" = 'table_tennis_court' THEN
          IF to_regclass('public.table_tennis_courts') IS NULL THEN
            RAISE EXCEPTION 'table_tennis_courts is not available'
              USING ERRCODE = '42P01';
          END IF;
          IF NOT EXISTS (
            SELECT 1
            FROM "table_tennis_courts" c
            WHERE c."id" = NEW."courtId"
              AND c."tenantId" = NEW."tenantId"
          ) THEN
            RAISE EXCEPTION 'table_tennis_court not found for tenant: % (courtId=%)', NEW."tenantId", NEW."courtId"
              USING ERRCODE = '23503';
          END IF;
        ELSE
          RAISE EXCEPTION 'unsupported courtKind: %', NEW."courtKind"
            USING ERRCODE = '23514';
        END IF;

        RETURN NEW;
      END
      $f$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "table_tennis_courts"`);
  }
}
