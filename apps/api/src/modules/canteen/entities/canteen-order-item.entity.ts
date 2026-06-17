import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CanteenOrder } from './canteen-order.entity';

@Entity({ name: 'canteen_order_items' })
export class CanteenOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => CanteenOrder, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order!: CanteenOrder;

  @Column({ type: 'uuid' })
  itemId!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  lineTotal!: string;
}
