import { MigrationInterface, QueryRunner } from 'typeorm';

export class BusinessLocationBannerImage1711000000014 implements MigrationInterface {
  name = 'BusinessLocationBannerImage1711000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business_locations"
      ADD COLUMN IF NOT EXISTS "bannerImage" varchar(2048)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_locations" DROP COLUMN IF EXISTS "bannerImage"`,
    );
  }
}
