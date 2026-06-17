import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsumerFeatures1711000000051 implements MigrationInterface {
  name = 'ConsumerFeatures1711000000051';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_attempts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "entityType" varchar(32) NOT NULL,
        "entityId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "gateway" varchar(20) NOT NULL,
        "amount" decimal(12,2) NOT NULL,
        "currency" varchar(8) NOT NULL DEFAULT 'PKR',
        "status" varchar(24) NOT NULL DEFAULT 'initiated',
        "transactionId" varchar(120) NOT NULL,
        "idempotencyKey" varchar(120),
        "failureReason" text,
        "gatewayFormFields" jsonb,
        "paymentUrl" text,
        "returnUrl" text,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "completedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_payment_attempts_idempotency"
      ON "payment_attempts" ("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payment_attempts_entity"
      ON "payment_attempts" ("entityType", "entityId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payment_attempts_txn"
      ON "payment_attempts" ("transactionId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "canteen_orders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "locationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "bookingId" uuid,
        "status" varchar(24) NOT NULL DEFAULT 'pending',
        "paymentStatus" varchar(24) NOT NULL DEFAULT 'pending',
        "paymentMethod" varchar(24) NOT NULL DEFAULT 'pay_at_venue',
        "subTotal" decimal(12,2) NOT NULL DEFAULT 0,
        "tax" decimal(12,2) NOT NULL DEFAULT 0,
        "totalAmount" decimal(12,2) NOT NULL DEFAULT 0,
        "currency" varchar(8) NOT NULL DEFAULT 'PKR',
        "pickupAt" TIMESTAMPTZ,
        "notes" text,
        "idempotencyKey" varchar(120),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_canteen_orders_location" FOREIGN KEY ("locationId") REFERENCES "business_locations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_canteen_orders_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_canteen_orders_booking" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_canteen_orders_idempotency"
      ON "canteen_orders" ("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_canteen_orders_user" ON "canteen_orders" ("userId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "canteen_order_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "orderId" uuid NOT NULL,
        "itemId" uuid NOT NULL,
        "name" varchar(200) NOT NULL,
        "quantity" int NOT NULL,
        "unitPrice" decimal(12,2) NOT NULL,
        "lineTotal" decimal(12,2) NOT NULL,
        CONSTRAINT "fk_canteen_order_items_order" FOREIGN KEY ("orderId") REFERENCES "canteen_orders"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_canteen_order_items_item" FOREIGN KEY ("itemId") REFERENCES "canteen_items"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "support_tickets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "ticketNumber" varchar(32) NOT NULL,
        "category" varchar(32) NOT NULL,
        "subject" varchar(300) NOT NULL,
        "status" varchar(24) NOT NULL DEFAULT 'open',
        "priority" varchar(16) NOT NULL DEFAULT 'normal',
        "bookingId" uuid,
        "canteenOrderId" uuid,
        "tournamentRegistrationId" uuid,
        "lastMessageAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_support_tickets_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_support_tickets_number"
      ON "support_tickets" ("ticketNumber")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_support_tickets_user"
      ON "support_tickets" ("userId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "support_ticket_messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ticketId" uuid NOT NULL,
        "authorType" varchar(16) NOT NULL,
        "authorUserId" uuid,
        "authorName" varchar(200) NOT NULL,
        "body" text NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_support_ticket_messages_ticket" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "journey_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid,
        "userId" uuid NOT NULL,
        "sessionId" varchar(120),
        "eventType" varchar(64) NOT NULL,
        "properties" jsonb NOT NULL DEFAULT '{}',
        "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_journey_events_user"
      ON "journey_events" ("userId", "occurredAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "journey_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "support_ticket_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "support_tickets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "canteen_order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "canteen_orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_attempts"`);
  }
}
