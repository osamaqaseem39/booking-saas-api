import { MigrationInterface, QueryRunner } from 'typeorm';

export class CanteenInventory1711000000043 implements MigrationInterface {
  name = 'CanteenInventory1711000000043';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "canteen_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "locationId" uuid NOT NULL,
        "name" varchar(200) NOT NULL,
        "category" varchar(100) NOT NULL DEFAULT 'General',
        "stockQuantity" integer NOT NULL DEFAULT 0,
        "unit" varchar(50) NOT NULL DEFAULT 'pcs',
        "purchasePrice" numeric(12,2) NOT NULL DEFAULT 0,
        "sellingPrice" numeric(12,2) NOT NULL DEFAULT 0,
        "expiryDate" date,
        "lowStockThreshold" integer NOT NULL DEFAULT 10,
        "status" varchar(20) NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_canteen_items_location" FOREIGN KEY ("locationId") REFERENCES "business_locations"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "canteen_items"`);
  }
}
