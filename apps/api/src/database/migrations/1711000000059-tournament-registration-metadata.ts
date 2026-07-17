import { MigrationInterface, QueryRunner } from 'typeorm';

export class TournamentRegistrationMetadata1711000000059
  implements MigrationInterface
{
  name = 'TournamentRegistrationMetadata1711000000059';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tournament_registrations"
      ADD COLUMN IF NOT EXISTS "metadata" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tournament_registrations" DROP COLUMN IF EXISTS "metadata"`,
    );
  }
}
