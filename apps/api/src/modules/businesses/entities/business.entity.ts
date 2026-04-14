import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'businesses' })
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  tenantId!: string;

  @Column({ type: 'varchar', length: 180, unique: true })
  businessName!: string;

  @Column({ type: 'varchar', length: 220, nullable: true })
  legalName?: string;

  @Column({ type: 'jsonb', nullable: true })
  owner?: { name?: string; email?: string; phone?: string } | null;

  @Column({ type: 'jsonb', nullable: true })
  subscription?: {
    plan?: string;
    status?: string;
    billingCycle?: string;
  } | null;

  @Column({ type: 'jsonb', nullable: true })
  settings?: {
    timezone?: string;
    currency?: string;
    allowOnlinePayments?: boolean;
  } | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
