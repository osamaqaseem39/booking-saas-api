import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappChannels1711000000047 implements MigrationInterface {
  name = 'WhatsappChannels1711000000047';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_channels" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "locationId" uuid,
        "phoneNumberId" varchar(64) NOT NULL,
        "displayNumber" varchar(32) NOT NULL,
        "wabaId" varchar(64) NOT NULL,
        "accessToken" text NOT NULL,
        "status" varchar(24) NOT NULL DEFAULT 'connected',
        "botEnabled" boolean NOT NULL DEFAULT true,
        "greetingMessage" text,
        "defaultLocationId" uuid,
        "lastWebhookAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_whatsapp_phone_number_id" UNIQUE ("phoneNumberId"),
        CONSTRAINT "fk_whatsapp_location" FOREIGN KEY ("locationId") REFERENCES "business_locations"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_whatsapp_default_location" FOREIGN KEY ("defaultLocationId") REFERENCES "business_locations"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_whatsapp_channels_tenant" ON "whatsapp_channels" ("tenantId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_whatsapp_channels_location" ON "whatsapp_channels" ("locationId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_channels"`);
  }
}
