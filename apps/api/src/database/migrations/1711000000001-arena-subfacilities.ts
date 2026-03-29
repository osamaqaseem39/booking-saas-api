import { MigrationInterface, QueryRunner } from 'typeorm';

export class ArenaSubfacilities1711000000001 implements MigrationInterface {
  name = 'ArenaSubfacilities1711000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cricket_indoor_courts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(160) NOT NULL,
        "description" text,
        "laneCount" int,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cricket_indoor_tenant" ON "cricket_indoor_courts" ("tenantId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "futsal_fields" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(160) NOT NULL,
        "description" text,
        "dimensions" varchar(80),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_futsal_fields_tenant" ON "futsal_fields" ("tenantId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "padel_courts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(160) NOT NULL,
        "description" text,
        "surfaceType" varchar(80),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_padel_courts_tenant" ON "padel_courts" ("tenantId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "padel_courts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "futsal_fields"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cricket_indoor_courts"`);
  }
}
