import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Strengthens referential integrity without API/DTO changes:
 * - BEFORE triggers: (courtKind, courtId) + tenant must resolve to padel_courts or turf_courts.
 * - BEFORE trigger: tenant_time_slot_template_lines.tenantId must match parent template.
 * - Optional FK: tenantId → businesses("tenantId") when there are no orphan rows.
 * - Optional FK: timeSlotTemplateId → tenant_time_slot_templates when there are no orphan template refs.
 */
export class TenantCourtFkIntegrity1711000000037 implements MigrationInterface {
  name = 'TenantCourtFkIntegrity1711000000037';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
        ELSE
          RAISE EXCEPTION 'unsupported courtKind: %', NEW."courtKind"
            USING ERRCODE = '23514';
        END IF;

        RETURN NEW;
      END
      $f$;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_booking_items_court_ref" ON "booking_items"
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_booking_items_court_ref"
      BEFORE INSERT OR UPDATE OF "bookingId", "courtKind", "courtId" ON "booking_items"
      FOR EACH ROW
      EXECUTE PROCEDURE booking_items_enforce_court_ref()
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
        ELSE
          RAISE EXCEPTION 'unsupported courtKind: %', NEW."courtKind"
            USING ERRCODE = '23514';
        END IF;

        RETURN NEW;
      END
      $f$;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_court_facility_slots_court_ref" ON "court_facility_slots"
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_court_facility_slots_court_ref"
      BEFORE INSERT OR UPDATE OF "tenantId", "courtKind", "courtId" ON "court_facility_slots"
      FOR EACH ROW
      EXECUTE PROCEDURE court_facility_slots_enforce_court_ref()
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
        ELSE
          RAISE EXCEPTION 'unsupported courtKind: %', NEW."courtKind"
            USING ERRCODE = '23514';
        END IF;

        RETURN NEW;
      END
      $f$;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_court_slot_booking_blocks_court_ref" ON "court_slot_booking_blocks"
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_court_slot_booking_blocks_court_ref"
      BEFORE INSERT OR UPDATE OF "tenantId", "courtKind", "courtId" ON "court_slot_booking_blocks"
      FOR EACH ROW
      EXECUTE PROCEDURE court_slot_booking_blocks_enforce_court_ref()
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION tenant_time_slot_template_lines_enforce_tenant()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $f$
      DECLARE
        v_tenant_id uuid;
      BEGIN
        SELECT t."tenantId" INTO v_tenant_id
        FROM "tenant_time_slot_templates" t
        WHERE t."id" = NEW."templateId";

        IF v_tenant_id IS NULL THEN
          RAISE EXCEPTION 'time slot template not found: %', NEW."templateId"
            USING ERRCODE = '23503';
        END IF;
        IF NEW."tenantId" IS DISTINCT FROM v_tenant_id THEN
          RAISE EXCEPTION 'template line tenantId (%) does not match template (%)', NEW."tenantId", v_tenant_id
            USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END
      $f$;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_tenant_time_slot_template_lines_tenant" ON "tenant_time_slot_template_lines"
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_tenant_time_slot_template_lines_tenant"
      BEFORE INSERT OR UPDATE OF "templateId", "tenantId" ON "tenant_time_slot_template_lines"
      FOR EACH ROW
      EXECUTE PROCEDURE tenant_time_slot_template_lines_enforce_tenant()
    `);

    await queryRunner.query(`
      DO $m$
      DECLARE
        n int;
      BEGIN
        SELECT count(*)::int INTO n
        FROM "bookings" b
        WHERE NOT EXISTS (
          SELECT 1 FROM "businesses" s WHERE s."tenantId" = b."tenantId"
        );
        IF n = 0 THEN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'FK_bookings_tenant_business'
          ) THEN
            ALTER TABLE "bookings"
              ADD CONSTRAINT "FK_bookings_tenant_business"
              FOREIGN KEY ("tenantId") REFERENCES "businesses"("tenantId")
              ON DELETE NO ACTION
              NOT VALID;
            ALTER TABLE "bookings" VALIDATE CONSTRAINT "FK_bookings_tenant_business";
          END IF;
        ELSE
          RAISE NOTICE 'Skip FK_bookings_tenant_business: % rows with no matching businesses.tenantId', n;
        END IF;
      END
      $m$;
    `);

    await queryRunner.query(`
      DO $m$
      DECLARE
        n int;
      BEGIN
        SELECT count(*)::int INTO n
        FROM "court_facility_slots" x
        WHERE NOT EXISTS (
          SELECT 1 FROM "businesses" s WHERE s."tenantId" = x."tenantId"
        );
        IF n = 0 THEN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'FK_court_facility_slots_tenant_business'
          ) THEN
            ALTER TABLE "court_facility_slots"
              ADD CONSTRAINT "FK_court_facility_slots_tenant_business"
              FOREIGN KEY ("tenantId") REFERENCES "businesses"("tenantId")
              ON DELETE NO ACTION
              NOT VALID;
            ALTER TABLE "court_facility_slots" VALIDATE CONSTRAINT "FK_court_facility_slots_tenant_business";
          END IF;
        ELSE
          RAISE NOTICE 'Skip FK_court_facility_slots_tenant_business: % rows with no matching businesses.tenantId', n;
        END IF;
      END
      $m$;
    `);

    await queryRunner.query(`
      DO $m$
      DECLARE
        n int;
      BEGIN
        SELECT count(*)::int INTO n
        FROM "court_slot_booking_blocks" x
        WHERE NOT EXISTS (
          SELECT 1 FROM "businesses" s WHERE s."tenantId" = x."tenantId"
        );
        IF n = 0 THEN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'FK_court_slot_blocks_tenant_business'
          ) THEN
            ALTER TABLE "court_slot_booking_blocks"
              ADD CONSTRAINT "FK_court_slot_blocks_tenant_business"
              FOREIGN KEY ("tenantId") REFERENCES "businesses"("tenantId")
              ON DELETE NO ACTION
              NOT VALID;
            ALTER TABLE "court_slot_booking_blocks" VALIDATE CONSTRAINT "FK_court_slot_blocks_tenant_business";
          END IF;
        ELSE
          RAISE NOTICE 'Skip FK_court_slot_blocks_tenant_business: % rows with no matching businesses.tenantId', n;
        END IF;
      END
      $m$;
    `);

    await queryRunner.query(`
      DO $m$
      DECLARE
        n int;
      BEGIN
        SELECT count(*)::int INTO n
        FROM "tenant_time_slot_template_lines" l
        WHERE NOT EXISTS (
          SELECT 1 FROM "businesses" s WHERE s."tenantId" = l."tenantId"
        );
        IF n = 0 THEN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'FK_tenant_time_slot_template_lines_tenant_business'
          ) THEN
            ALTER TABLE "tenant_time_slot_template_lines"
              ADD CONSTRAINT "FK_tenant_time_slot_template_lines_tenant_business"
              FOREIGN KEY ("tenantId") REFERENCES "businesses"("tenantId")
              ON DELETE NO ACTION
              NOT VALID;
            ALTER TABLE "tenant_time_slot_template_lines" VALIDATE CONSTRAINT "FK_tenant_time_slot_template_lines_tenant_business";
          END IF;
        ELSE
          RAISE NOTICE 'Skip FK_tenant_time_slot_template_lines_tenant_business: % rows', n;
        END IF;
      END
      $m$;
    `);

    await queryRunner.query(`
      DO $m$
      BEGIN
        IF to_regclass('public.tenant_time_slot_templates') IS NOT NULL THEN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_tenant_time_slot_templates_tenant_business') THEN
            IF NOT EXISTS (
              SELECT 1
              FROM "tenant_time_slot_templates" t
              WHERE NOT EXISTS (
                SELECT 1 FROM "businesses" s WHERE s."tenantId" = t."tenantId"
              )
            ) THEN
              ALTER TABLE "tenant_time_slot_templates"
                ADD CONSTRAINT "FK_tenant_time_slot_templates_tenant_business"
                FOREIGN KEY ("tenantId") REFERENCES "businesses"("tenantId")
                ON DELETE NO ACTION
                NOT VALID;
              ALTER TABLE "tenant_time_slot_templates" VALIDATE CONSTRAINT "FK_tenant_time_slot_templates_tenant_business";
            END IF;
          END IF;
        END IF;
      END
      $m$;
    `);

    await queryRunner.query(`
      DO $m$
      BEGIN
        IF to_regclass('public.turf_courts') IS NULL THEN
          RAISE NOTICE 'turf_courts missing; skip FK for tenant';
        ELSIF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_turf_courts_tenant_business') THEN
          IF NOT EXISTS (
            SELECT 1
            FROM "turf_courts" t
            WHERE NOT EXISTS (SELECT 1 FROM "businesses" s WHERE s."tenantId" = t."tenantId")
          ) THEN
            ALTER TABLE "turf_courts"
              ADD CONSTRAINT "FK_turf_courts_tenant_business"
              FOREIGN KEY ("tenantId") REFERENCES "businesses"("tenantId")
              ON DELETE NO ACTION
              NOT VALID;
            ALTER TABLE "turf_courts" VALIDATE CONSTRAINT "FK_turf_courts_tenant_business";
          END IF;
        END IF;
      END
      $m$;
    `);

    await queryRunner.query(`
      DO $m$
      BEGIN
        IF to_regclass('public.padel_courts') IS NULL THEN
          RAISE NOTICE 'padel_courts missing; skip FK for tenant and timeSlotTemplateId';
        ELSIF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_padel_courts_tenant_business') THEN
          IF NOT EXISTS (
            SELECT 1
            FROM "padel_courts" p
            WHERE NOT EXISTS (SELECT 1 FROM "businesses" s WHERE s."tenantId" = p."tenantId")
          ) THEN
            ALTER TABLE "padel_courts"
              ADD CONSTRAINT "FK_padel_courts_tenant_business"
              FOREIGN KEY ("tenantId") REFERENCES "businesses"("tenantId")
              ON DELETE NO ACTION
              NOT VALID;
            ALTER TABLE "padel_courts" VALIDATE CONSTRAINT "FK_padel_courts_tenant_business";
          END IF;
        END IF;
      END
      $m$;
    `);

    await queryRunner.query(`
      DO $m$
      BEGIN
        IF to_regclass('public.padel_courts') IS NULL OR to_regclass('public.tenant_time_slot_templates') IS NULL THEN
          RAISE NOTICE 'padel_courts or tenant_time_slot_templates missing; skip timeSlotTemplateId FK';
        ELSIF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_padel_courts_time_slot_template') THEN
          IF NOT EXISTS (
            SELECT 1
            FROM "padel_courts" p
            WHERE p."timeSlotTemplateId" IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM "tenant_time_slot_templates" t WHERE t."id" = p."timeSlotTemplateId"
              )
          ) THEN
            ALTER TABLE "padel_courts"
              ADD CONSTRAINT "FK_padel_courts_time_slot_template"
              FOREIGN KEY ("timeSlotTemplateId") REFERENCES "tenant_time_slot_templates"("id")
              ON DELETE SET NULL
              NOT VALID;
            ALTER TABLE "padel_courts" VALIDATE CONSTRAINT "FK_padel_courts_time_slot_template";
          END IF;
        END IF;
      END
      $m$;
    `);

    await queryRunner.query(`
      DO $m$
      BEGIN
        IF to_regclass('public.turf_courts') IS NULL OR to_regclass('public.tenant_time_slot_templates') IS NULL THEN
          RAISE NOTICE 'turf_courts or tenant_time_slot_templates missing; skip timeSlotTemplateId FK';
        ELSIF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_turf_courts_time_slot_template') THEN
          IF NOT EXISTS (
            SELECT 1
            FROM "turf_courts" u
            WHERE u."timeSlotTemplateId" IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM "tenant_time_slot_templates" t WHERE t."id" = u."timeSlotTemplateId"
              )
          ) THEN
            ALTER TABLE "turf_courts"
              ADD CONSTRAINT "FK_turf_courts_time_slot_template"
              FOREIGN KEY ("timeSlotTemplateId") REFERENCES "tenant_time_slot_templates"("id")
              ON DELETE SET NULL
              NOT VALID;
            ALTER TABLE "turf_courts" VALIDATE CONSTRAINT "FK_turf_courts_time_slot_template";
          END IF;
        END IF;
      END
      $m$;
    `);

    await queryRunner.query(`
      DO $m$
      BEGIN
        IF to_regclass('public.gaming_stations') IS NULL THEN
          RAISE NOTICE 'gaming_stations missing; skip FK for tenant';
        ELSIF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_gaming_stations_tenant_business') THEN
          IF NOT EXISTS (
            SELECT 1
            FROM "gaming_stations" g
            WHERE NOT EXISTS (SELECT 1 FROM "businesses" s WHERE s."tenantId" = g."tenantId")
          ) THEN
            ALTER TABLE "gaming_stations"
              ADD CONSTRAINT "FK_gaming_stations_tenant_business"
              FOREIGN KEY ("tenantId") REFERENCES "businesses"("tenantId")
              ON DELETE NO ACTION
              NOT VALID;
            ALTER TABLE "gaming_stations" VALIDATE CONSTRAINT "FK_gaming_stations_tenant_business";
          END IF;
        END IF;
      END
      $m$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $m$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_gaming_stations_tenant_business') THEN
          ALTER TABLE "gaming_stations" DROP CONSTRAINT "FK_gaming_stations_tenant_business";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_turf_courts_time_slot_template') THEN
          ALTER TABLE "turf_courts" DROP CONSTRAINT "FK_turf_courts_time_slot_template";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_padel_courts_time_slot_template') THEN
          ALTER TABLE "padel_courts" DROP CONSTRAINT "FK_padel_courts_time_slot_template";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_padel_courts_tenant_business') THEN
          ALTER TABLE "padel_courts" DROP CONSTRAINT "FK_padel_courts_tenant_business";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_turf_courts_tenant_business') THEN
          ALTER TABLE "turf_courts" DROP CONSTRAINT "FK_turf_courts_tenant_business";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_tenant_time_slot_templates_tenant_business') THEN
          ALTER TABLE "tenant_time_slot_templates" DROP CONSTRAINT "FK_tenant_time_slot_templates_tenant_business";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_tenant_time_slot_template_lines_tenant_business') THEN
          ALTER TABLE "tenant_time_slot_template_lines" DROP CONSTRAINT "FK_tenant_time_slot_template_lines_tenant_business";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_court_slot_blocks_tenant_business') THEN
          ALTER TABLE "court_slot_booking_blocks" DROP CONSTRAINT "FK_court_slot_blocks_tenant_business";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_court_facility_slots_tenant_business') THEN
          ALTER TABLE "court_facility_slots" DROP CONSTRAINT "FK_court_facility_slots_tenant_business";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_bookings_tenant_business') THEN
          ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_tenant_business";
        END IF;
      END
      $m$;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_tenant_time_slot_template_lines_tenant" ON "tenant_time_slot_template_lines"
    `);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS tenant_time_slot_template_lines_enforce_tenant()`,
    );

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_court_slot_booking_blocks_court_ref" ON "court_slot_booking_blocks"
    `);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS court_slot_booking_blocks_enforce_court_ref()`,
    );

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_court_facility_slots_court_ref" ON "court_facility_slots"
    `);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS court_facility_slots_enforce_court_ref()`,
    );

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_booking_items_court_ref" ON "booking_items"
    `);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS booking_items_enforce_court_ref()`,
    );
  }
}
