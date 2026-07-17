import { MigrationInterface, QueryRunner } from 'typeorm';

export class TournamentBannerImage1711000000058 implements MigrationInterface {
  name = 'TournamentBannerImage1711000000058';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tournaments"
      ADD COLUMN IF NOT EXISTS "bannerImage" varchar(2048)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "bannerImage"`,
    );
  }
}
