import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPermissions1711000000057 implements MigrationInterface {
  name = 'UserPermissions1711000000057';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_permissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "permissionKey" varchar(80) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_user_permissions" PRIMARY KEY ("id"),
        CONSTRAINT "uq_user_permission" UNIQUE ("userId", "permissionKey"),
        CONSTRAINT "fk_user_permissions_user" FOREIGN KEY ("userId")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_user_permissions_user"
      ON "user_permissions" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_permissions"`);
  }
}
