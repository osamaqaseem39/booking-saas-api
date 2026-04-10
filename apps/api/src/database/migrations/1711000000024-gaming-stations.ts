import { MigrationInterface, QueryRunner } from 'typeorm';

export class GamingStations1711000000024 implements MigrationInterface {
  name = 'GamingStations1711000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gaming_stations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "businessLocationId" uuid NOT NULL,
        "setupCode" character varying(40) NOT NULL,
        "name" character varying(160) NOT NULL,
        "unitStatus" character varying(20) NOT NULL DEFAULT 'active',
        "isActive" boolean NOT NULL DEFAULT true,
        "description" text,
        "imageUrls" jsonb,
        "pricePerSlot" numeric(12,2),
        "peakPricing" jsonb,
        "bundleNote" text,
        "slotDurationMinutes" integer,
        "bufferBetweenSlotsMinutes" integer,
        "amenities" jsonb,
        "specs" jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_gaming_stations_business_location" FOREIGN KEY ("businessLocationId") REFERENCES "business_locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_gaming_stations_tenant" ON "gaming_stations" ("tenantId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_gaming_stations_location" ON "gaming_stations" ("businessLocationId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_gaming_stations_setup_code" ON "gaming_stations" ("setupCode")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_gaming_stations_setup_code"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_gaming_stations_location"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_gaming_stations_tenant"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gaming_stations"`);
  }
}
