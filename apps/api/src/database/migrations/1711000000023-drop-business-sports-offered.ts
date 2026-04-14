import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropBusinessSportsOffered1711000000023 implements MigrationInterface {
  name = 'DropBusinessSportsOffered1711000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN IF EXISTS "sportsOffered"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "sportsOffered" text array`,
    );
  }
}
