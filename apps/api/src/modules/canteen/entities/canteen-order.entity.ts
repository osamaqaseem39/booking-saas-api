import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CanteenOrderItem } from './canteen-order-item.entity';

@Entity({ name: 'canteen_orders' })
export class CanteenOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  locationId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid', nullable: true })
  bookingId?: string | null;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status!: string;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  paymentStatus!: string;

  @Column({ type: 'varchar', length: 24, default: 'pay_at_venue' })
  paymentMethod!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: '0' })
  subTotal!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: '0' })
  tax!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: '0' })
  totalAmount!: string;

  @Column({ type: 'varchar', length: 8, default: 'PKR' })
  currency!: string;

  @Column({ type: 'timestamptz', nullable: true })
  pickupAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  idempotencyKey?: string | null;

  @OneToMany(() => CanteenOrderItem, (i) => i.order, { cascade: true })
  items!: CanteenOrderItem[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
