import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  TurfCoveredType,
  TurfPricingConfig,
  TurfSportConfig,
  TurfSportType,
  TurfStatus,
} from '../turf.types';

@Entity({ name: 'turf_courts' })
export class TurfCourt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  branchId!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: TurfStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  length?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  width?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  ceilingHeight?: string;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  coveredType!: TurfCoveredType;

  @Column({ type: 'varchar', length: 80, nullable: true })
  surfaceType?: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  turfQuality?: string;

  @Column('text', { array: true, default: '{}' })
  supportedSports!: TurfSportType[];

  @Column({ type: 'jsonb', nullable: true })
  sportConfig?: TurfSportConfig;

  @Column({ type: 'jsonb', nullable: true })
  pricing?: TurfPricingConfig;

  @Column({ type: 'int', default: 60 })
  slotDuration!: number;

  @Column({ type: 'int', default: 0 })
  bufferTime!: number;

  @Column({ type: 'uuid', nullable: true })
  timeSlotTemplateId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
