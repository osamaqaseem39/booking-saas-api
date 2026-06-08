import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappProcessedMessages1711000000049 implements MigrationInterface {
  name = 'WhatsappProcessedMessages1711000000049';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_processed_messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "messageId" varchar(128) NOT NULL,
        "processedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_whatsapp_processed_message_id" UNIQUE ("messageId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_whatsapp_processed_at" ON "whatsapp_processed_messages" ("processedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_processed_messages"`);
  }
}
