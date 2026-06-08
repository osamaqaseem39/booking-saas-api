import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappConversations1711000000048 implements MigrationInterface {
  name = 'WhatsappConversations1711000000048';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_conversations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "channelId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "customerWaId" varchar(24) NOT NULL,
        "step" varchar(32) NOT NULL DEFAULT 'menu',
        "state" jsonb NOT NULL DEFAULT '{}',
        "lastMessageAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_whatsapp_conv_channel_customer" UNIQUE ("channelId", "customerWaId"),
        CONSTRAINT "fk_whatsapp_conv_channel" FOREIGN KEY ("channelId") REFERENCES "whatsapp_channels"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_whatsapp_conv_tenant" ON "whatsapp_conversations" ("tenantId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_conversations"`);
  }
}
