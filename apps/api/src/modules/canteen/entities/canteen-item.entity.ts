import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'canteen_items' })
export class CanteenItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  locationId!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 100, default: 'General' })
  category!: string;

  @Column({ type: 'int', default: 0 })
  stockQuantity!: number;

  @Column({ type: 'varchar', length: 50, default: 'pcs' })
  unit!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  purchasePrice!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  sellingPrice!: string;

  @Column({ type: 'date', nullable: true })
  expiryDate?: string | null;

  @Column({ type: 'int', default: 10 })
  lowStockThreshold!: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
