import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BusinessLocation } from '../../businesses/entities/business-location.entity';

@Entity({ name: 'canteen_items' })
export class CanteenItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  locationId: string;

  @ManyToOne(() => BusinessLocation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: BusinessLocation;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 100, default: 'General' })
  category: string; // Drink, Snack, Meal, etc.

  @Column({ type: 'int', default: 0 })
  stockQuantity: number;

  @Column({ type: 'varchar', length: 50, default: 'pcs' })
  unit: string; // pcs, bottle, kg

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  purchasePrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  sellingPrice: number;

  @Column({ type: 'date', nullable: true })
  expiryDate: Date;

  @Column({ type: 'int', default: 10 })
  lowStockThreshold: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
