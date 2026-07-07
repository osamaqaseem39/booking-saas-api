import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type PromoDiscountType = 'percent' | 'fixed';

@Entity({ name: 'tenant_promo_codes' })
@Unique('UQ_tenant_promo_codes_tenant_code', ['tenantId', 'code'])
export class TenantPromoCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 32 })
  code!: string;

  @Column({ type: 'varchar', length: 16 })
  discountType!: PromoDiscountType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  discountValue!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  minSubTotal?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  validFrom?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  validTo?: Date | null;

  @Column({ type: 'int', nullable: true })
  maxUses?: number | null;

  @Column({ type: 'int', default: 0 })
  usedCount!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
