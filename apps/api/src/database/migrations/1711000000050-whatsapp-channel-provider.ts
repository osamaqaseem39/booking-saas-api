import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappChannelProvider1711000000050 implements MigrationInterface {
  name = 'WhatsappChannelProvider1711000000050';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "whatsapp_channels"
      ADD COLUMN IF NOT EXISTS "provider" varchar(16) NOT NULL DEFAULT 'meta'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "whatsapp_channels" DROP COLUMN IF EXISTS "provider"
    `);
  }
}
