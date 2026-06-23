import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappMessages1711000000053 implements MigrationInterface {
  name = 'WhatsappMessages1711000000053';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "conversationId" uuid NOT NULL,
        "channelId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "customerWaId" varchar(24) NOT NULL,
        "direction" varchar(16) NOT NULL,
        "body" text NOT NULL,
        "externalMessageId" varchar(128),
        "deliveryStatus" varchar(16) NOT NULL DEFAULT 'received',
        "deliveryError" text,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_whatsapp_msg_conv" FOREIGN KEY ("conversationId")
          REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_whatsapp_msg_conv" ON "whatsapp_messages" ("conversationId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_whatsapp_msg_pending"
        ON "whatsapp_messages" ("deliveryStatus", "createdAt")
        WHERE "direction" = 'outbound' AND "deliveryStatus" = 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_messages"`);
  }
}
