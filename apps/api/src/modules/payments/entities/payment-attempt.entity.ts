import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PaymentAttemptStatus =
  | 'initiated'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'expired'
  | 'cancelled';

export type PaymentEntityType =
  | 'booking'
  | 'tournament_registration'
  | 'canteen_order';

@Entity({ name: 'payment_attempts' })
export class PaymentAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  entityType!: PaymentEntityType;

  @Column({ type: 'uuid' })
  entityId!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 20 })
  gateway!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 8, default: 'PKR' })
  currency!: string;

  @Column({ type: 'varchar', length: 24, default: 'initiated' })
  status!: PaymentAttemptStatus;

  @Column({ type: 'varchar', length: 120 })
  transactionId!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  idempotencyKey?: string | null;

  @Column({ type: 'text', nullable: true })
  failureReason?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  gatewayFormFields?: Record<string, string> | null;

  @Column({ type: 'text', nullable: true })
  paymentUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  returnUrl?: string | null;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
