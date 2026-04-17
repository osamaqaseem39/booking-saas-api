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

  @Column('text', { array: true, default: '{}' })
  imageUrls!: string[];

  @Column({ type: 'varchar', length: 160, nullable: true })
  arenaLabel?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  length?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  width?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  ceilingHeight?: string;

  @Column({ type: 'varchar', length: 10, default: 'm' })
  ceilingHeightUnit!: string;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  coveredType!: TurfCoveredType;

  @Column({ type: 'boolean', default: false })
  sideNetting!: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  netHeight?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  boundaryType?: string;

  @Column('text', { array: true, default: '{}' })
  ventilation!: string[];

  @Column({ type: 'varchar', length: 40, nullable: true })
  lighting?: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  surfaceType?: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  turfQuality?: string;

  @Column({ type: 'boolean', default: false })
  shockAbsorptionLayer!: boolean;

  @Column('text', { array: true, default: '{}' })
  supportedSports!: TurfSportType[];

  @Column({ type: 'jsonb', nullable: true })
  sportConfig?: TurfSportConfig;

  @Column({ type: 'jsonb', nullable: true })
  pricing?: TurfPricingConfig;

  @Column({ type: 'jsonb', nullable: true })
  discountMembership?: any;

  @Column({ type: 'jsonb', nullable: true })
  amenities?: any;

  @Column({ type: 'jsonb', nullable: true })
  rules?: any;

  @Column({ type: 'int', default: 60 })
  slotDuration!: number;

  @Column({ type: 'int', default: 0 })
  bufferTime!: number;

  @Column({ type: 'boolean', default: false })
  allowParallelBooking!: boolean;

  @Column({ type: 'uuid', nullable: true })
  timeSlotTemplateId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
