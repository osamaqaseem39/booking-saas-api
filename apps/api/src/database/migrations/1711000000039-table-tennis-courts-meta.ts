import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Optional JSON bag for table tennis–specific facility details (room, brand, amenities, rules). */
export class TableTennisCourtsMeta1711000000039 implements MigrationInterface {
  name = 'TableTennisCourtsMeta1711000000039';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "table_tennis_courts"
      ADD COLUMN IF NOT EXISTS "meta" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "table_tennis_courts" DROP COLUMN IF EXISTS "meta"
    `);
  }
}
