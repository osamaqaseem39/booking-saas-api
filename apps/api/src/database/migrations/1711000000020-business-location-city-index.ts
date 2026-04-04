import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Speeds lookups and future DISTINCT city queries for discovery (e.g. GET /getAllCities).
 */
export class BusinessLocationCityIndex1711000000020
  implements MigrationInterface
{
  name = 'BusinessLocationCityIndex1711000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_business_locations_city_nonempty"
      ON "business_locations" ("city")
      WHERE "city" IS NOT NULL AND TRIM("city") <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_business_locations_city_nonempty"`,
    );
  }
}
