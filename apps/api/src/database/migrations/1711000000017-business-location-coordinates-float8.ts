import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Match JS/dashboard numeric coordinates: decimal(10,6) rounded values and came back
 * as strings from the driver. double precision aligns with normalized 14-digit floats.
 */
export class BusinessLocationCoordinatesFloat81711000000017 implements MigrationInterface {
  name = 'BusinessLocationCoordinatesFloat81711000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ALTER COLUMN "latitude" TYPE double precision
      USING (
        CASE
          WHEN "latitude" IS NULL THEN NULL
          ELSE "latitude"::double precision
        END
      ),
      ALTER COLUMN "longitude" TYPE double precision
      USING (
        CASE
          WHEN "longitude" IS NULL THEN NULL
          ELSE "longitude"::double precision
        END
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ALTER COLUMN "latitude" TYPE decimal(10,6)
      USING (
        CASE
          WHEN "latitude" IS NULL THEN NULL
          ELSE round("latitude"::numeric, 6)
        END
      ),
      ALTER COLUMN "longitude" TYPE decimal(10,6)
      USING (
        CASE
          WHEN "longitude" IS NULL THEN NULL
          ELSE round("longitude"::numeric, 6)
        END
      )
    `);
  }
}
