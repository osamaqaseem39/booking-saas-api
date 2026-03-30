import { MigrationInterface, QueryRunner } from 'typeorm';

export class BusinessLocationLogoGallery1711000000012
  implements MigrationInterface
{
  name = 'BusinessLocationLogoGallery1711000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ADD COLUMN IF NOT EXISTS "logo" varchar(2048)
    `);
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ADD COLUMN IF NOT EXISTS "gallery" text[] NOT NULL DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_locations" DROP COLUMN IF EXISTS "gallery"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_locations" DROP COLUMN IF EXISTS "logo"`,
    );
  }
}
