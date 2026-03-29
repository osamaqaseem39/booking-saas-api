import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BusinessLocation } from '../../../businesses/entities/business-location.entity';

@Entity({ name: 'futsal_fields' })
export class FutsalField {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid', nullable: true })
  businessLocationId?: string;

  @ManyToOne(() => BusinessLocation, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'businessLocationId' })
  businessLocation?: BusinessLocation;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  /** e.g. "40x20m" or FIFA category label */
  @Column({ type: 'varchar', length: 80, nullable: true })
  dimensions?: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
