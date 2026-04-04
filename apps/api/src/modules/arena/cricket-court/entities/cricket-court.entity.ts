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
import type {
  ArenaAmenities,
  ArenaDiscountMembership,
  ArenaPeakPricing,
  ArenaRules,
} from '../../arena-court-json.types';

export type CricketCourtStatus = 'active' | 'maintenance';
export type CricketCeilingUnit = 'ft' | 'm';
export type CricketCoveredType = 'open' | 'semi_covered' | 'fully_indoor';
export type CricketBoundaryType = 'net' | 'wall';
export type CricketLighting = 'led_floodlights' | 'mixed' | 'daylight';
export type CricketSurfaceType = 'artificial_turf' | 'hard_surface';
export type CricketFormat = 'tape_ball' | 'tennis_ball' | 'hard_ball';
export type CricketPracticeMode = 'full_ground' | 'nets_mode';

@Entity({ name: 'cricket_courts' })
export class CricketCourt {
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

  @Column({ type: 'varchar', length: 120, nullable: true })
  arenaLabel?: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  courtStatus!: CricketCourtStatus;

  @Column({ type: 'jsonb', nullable: true })
  imageUrls?: string[];

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  ceilingHeightValue?: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  ceilingHeightUnit?: CricketCeilingUnit;

  @Column({ type: 'varchar', length: 20, nullable: true })
  coveredType?: CricketCoveredType;

  @Column({ type: 'boolean', nullable: true })
  sideNetting?: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  netHeight?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  boundaryType?: CricketBoundaryType;

  @Column({ type: 'jsonb', nullable: true })
  ventilation?: string[];

  @Column({ type: 'varchar', length: 24, nullable: true })
  lighting?: CricketLighting;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  lengthM?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  widthM?: string;

  @Column({ type: 'varchar', length: 24, nullable: true })
  surfaceType?: CricketSurfaceType;

  @Column({ type: 'varchar', length: 120, nullable: true })
  turfQuality?: string;

  @Column({ type: 'boolean', nullable: true })
  shockAbsorptionLayer?: boolean;

  @Column({ type: 'varchar', length: 16, nullable: true })
  cricketFormat?: CricketFormat;

  @Column({ type: 'boolean', nullable: true })
  cricketStumpsAvailable?: boolean;

  @Column({ type: 'boolean', nullable: true })
  cricketBowlingMachine?: boolean;

  @Column({ type: 'varchar', length: 16, nullable: true })
  cricketPracticeMode?: CricketPracticeMode;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  pricePerSlot?: string;

  @Column({ type: 'jsonb', nullable: true })
  peakPricing?: ArenaPeakPricing;

  @Column({ type: 'jsonb', nullable: true })
  discountMembership?: ArenaDiscountMembership;

  @Column({ type: 'int', nullable: true })
  slotDurationMinutes?: number;

  @Column({ type: 'int', nullable: true })
  bufferBetweenSlotsMinutes?: number;

  @Column({ type: 'boolean', nullable: true })
  allowParallelBooking?: boolean;

  @Column({ type: 'jsonb', nullable: true })
  amenities?: ArenaAmenities;

  @Column({ type: 'jsonb', nullable: true })
  rules?: ArenaRules;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
