import { MigrationInterface, QueryRunner } from 'typeorm';

export class BankAccountsAndPaymentTransactions1711000000044
  implements MigrationInterface
{
  name = 'BankAccountsAndPaymentTransactions1711000000044';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bank_accounts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "locationId" uuid NOT NULL,
        "title" varchar(200) NOT NULL,
        "bankName" varchar(200) NOT NULL,
        "accountNumber" varchar(100) NOT NULL,
        "accountHolder" varchar(200),
        "isDefault" boolean NOT NULL DEFAULT false,
        "status" varchar(20) NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_bank_accounts_location" FOREIGN KEY ("locationId") REFERENCES "business_locations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bank_accounts_location" ON "bank_accounts" ("locationId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_transactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "bookingId" uuid NOT NULL,
        "method" varchar(20) NOT NULL,
        "amount" decimal(12,2) NOT NULL,
        "bankAccountId" uuid,
        "transactionRef" varchar(200),
        "note" text,
        "paidAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_payment_txn_booking" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_payment_txn_bank_account" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payment_txn_booking" ON "payment_transactions" ("bookingId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bank_accounts"`);
  }
}
