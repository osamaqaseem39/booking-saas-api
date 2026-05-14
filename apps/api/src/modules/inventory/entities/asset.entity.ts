import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'assets' })
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  locationId!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 100 })
  type!: string;

  @Column({ type: 'int', default: 0 })
  totalQuantity!: number;

  @Column({ type: 'int', default: 0 })
  availableQuantity!: number;

  @Column({ type: 'varchar', length: 50, default: 'available' })
  status!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  rentalPrice?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
