import { MigrationInterface, QueryRunner } from 'typeorm';

export class BusinessLocations1711000000005 implements MigrationInterface {
  name = 'BusinessLocations1711000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_locations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "businessId" uuid NOT NULL,
        "name" varchar(200) NOT NULL,
        "locationType" varchar(80) NOT NULL DEFAULT 'other',
        "addressLine" varchar(400),
        "city" varchar(120),
        "phone" varchar(60),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_business_locations_business" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_business_locations_business" ON "business_locations" ("businessId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "business_locations"`);
  }
}
