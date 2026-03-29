import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitIamBusiness1711000000000 implements MigrationInterface {
  name = 'InitIamBusiness1711000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "fullName" varchar(150) NOT NULL,
        "email" varchar(180) NOT NULL UNIQUE,
        "phone" varchar(30),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "roles" (
        "code" varchar(50) PRIMARY KEY,
        "name" varchar(120) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_roles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "roleCode" varchar(50) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_user_role" UNIQUE ("userId", "roleCode"),
        CONSTRAINT "fk_user_roles_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_user_roles_role" FOREIGN KEY ("roleCode") REFERENCES "roles"("code") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "businesses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL UNIQUE,
        "businessName" varchar(180) NOT NULL UNIQUE,
        "legalName" varchar(220),
        "vertical" varchar(80) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_memberships" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "businessId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "membershipRole" varchar(30) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_business_membership" UNIQUE ("businessId", "userId"),
        CONSTRAINT "fk_membership_business" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_membership_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "business_memberships"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "businesses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
