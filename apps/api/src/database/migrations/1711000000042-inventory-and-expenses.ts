import { MigrationInterface, QueryRunner } from 'typeorm';

export class InventoryAndExpenses1711000000042 implements MigrationInterface {
  name = 'InventoryAndExpenses1711000000042';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "assets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "locationId" uuid NOT NULL,
        "name" varchar(200) NOT NULL,
        "description" text,
        "type" varchar(100) NOT NULL,
        "totalQuantity" integer NOT NULL DEFAULT 0,
        "availableQuantity" integer NOT NULL DEFAULT 0,
        "status" varchar(50) NOT NULL DEFAULT 'available',
        "rentalPrice" numeric(10,2),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_assets_location" FOREIGN KEY ("locationId") REFERENCES "business_locations"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "expenses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "locationId" uuid NOT NULL,
        "title" varchar(200) NOT NULL,
        "description" text,
        "amount" numeric(12,2) NOT NULL,
        "date" date NOT NULL,
        "category" varchar(100) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_expenses_location" FOREIGN KEY ("locationId") REFERENCES "business_locations"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "expenses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assets"`);
  }
}
