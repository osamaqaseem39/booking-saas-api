import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappChannelOpenwaBaseUrl1711000000052
  implements MigrationInterface
{
  name = 'WhatsappChannelOpenwaBaseUrl1711000000052';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "whatsapp_channels"
      ADD COLUMN IF NOT EXISTS "openwaApiBaseUrl" varchar(512)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "whatsapp_channels" DROP COLUMN IF EXISTS "openwaApiBaseUrl"
    `);
  }
}
