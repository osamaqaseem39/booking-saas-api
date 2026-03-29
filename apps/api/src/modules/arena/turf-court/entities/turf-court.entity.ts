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
  TurfAmenities,
  TurfDiscountMembership,
  TurfPeakPricing,
  TurfRules,
} from '../turf-court.types';
import type { TurfSportMode } from '../turf-sport-mode.util';

export type TurfCourtStatus = 'active' | 'maintenance';
export type TurfCeilingUnit = 'ft' | 'm';
export type TurfCoveredType = 'open' | 'semi_covered' | 'fully_indoor';
export type TurfBoundaryType = 'net' | 'wall';
export type TurfLighting = 'led_floodlights' | 'mixed' | 'daylight';
export type TurfSurfaceType = 'artificial_turf' | 'hard_surface';
export type TurfFutsalFormat = '5v5' | '6v6' | '7v7';
export type TurfFutsalLineMarkings = 'permanent' | 'temporary';
export type TurfCricketFormat = 'tape_ball' | 'tennis_ball' | 'hard_ball';
export type TurfCricketPracticeMode = 'full_ground' | 'nets_mode';

@Entity({ name: 'turf_courts' })
export class TurfCourt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid', nullable: true })
  businessLocationId?: string;

  @ManyToOne(() => BusinessLocation, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'businessLocationId' })
  businessLocation?: BusinessLocation;

  /** Display label for Arena dropdown (business may use name or external id) */
  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  arenaLabel?: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  courtStatus!: TurfCourtStatus;

  @Column({ type: 'jsonb', nullable: true })
  imageUrls?: string[];

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  ceilingHeightValue?: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  ceilingHeightUnit?: TurfCeilingUnit;

  @Column({ type: 'varchar', length: 20, nullable: true })
  coveredType?: TurfCoveredType;

  @Column({ type: 'boolean', nullable: true })
  sideNetting?: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  netHeight?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  boundaryType?: TurfBoundaryType;

  @Column({ type: 'jsonb', nullable: true })
  ventilation?: string[];

  @Column({ type: 'varchar', length: 24, nullable: true })
  lighting?: TurfLighting;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  lengthM?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  widthM?: string;

  @Column({ type: 'varchar', length: 24, nullable: true })
  surfaceType?: TurfSurfaceType;

  @Column({ type: 'varchar', length: 120, nullable: true })
  turfQuality?: string;

  @Column({ type: 'boolean', nullable: true })
  shockAbsorptionLayer?: boolean;

  /** Single form control: only futsal, only cricket, or both (kept in sync with supports* flags) */
  @Column({ type: 'varchar', length: 16, default: 'both' })
  sportMode!: TurfSportMode;

  @Column({ type: 'boolean', default: false })
  supportsFutsal!: boolean;

  @Column({ type: 'boolean', default: false })
  supportsCricket!: boolean;

  @Column({ type: 'varchar', length: 8, nullable: true })
  futsalFormat?: TurfFutsalFormat;

  @Column({ type: 'boolean', nullable: true })
  futsalGoalPostsAvailable?: boolean;

  @Column({ type: 'varchar', length: 80, nullable: true })
  futsalGoalPostSize?: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  futsalLineMarkings?: TurfFutsalLineMarkings;

  @Column({ type: 'varchar', length: 16, nullable: true })
  cricketFormat?: TurfCricketFormat;

  @Column({ type: 'boolean', nullable: true })
  cricketStumpsAvailable?: boolean;

  @Column({ type: 'boolean', nullable: true })
  cricketBowlingMachine?: boolean;

  @Column({ type: 'varchar', length: 16, nullable: true })
  cricketPracticeMode?: TurfCricketPracticeMode;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  futsalPricePerSlot?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  cricketPricePerSlot?: string;

  @Column({ type: 'jsonb', nullable: true })
  peakPricing?: TurfPeakPricing;

  @Column({ type: 'jsonb', nullable: true })
  discountMembership?: TurfDiscountMembership;

  @Column({ type: 'int', nullable: true })
  slotDurationMinutes?: number;

  @Column({ type: 'int', nullable: true })
  bufferBetweenSlotsMinutes?: number;

  @Column({ type: 'boolean', nullable: true })
  allowParallelBooking?: boolean;

  @Column({ type: 'jsonb', nullable: true })
  amenities?: TurfAmenities;

  @Column({ type: 'jsonb', nullable: true })
  rules?: TurfRules;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
