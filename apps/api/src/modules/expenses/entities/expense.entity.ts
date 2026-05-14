import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'expenses' })
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  locationId!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', length: 100 })
  category!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
