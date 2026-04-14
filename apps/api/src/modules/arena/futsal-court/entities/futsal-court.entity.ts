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
import type {
  CricketFormat,
  CricketPracticeMode,
} from '../../cricket-court/entities/cricket-court.entity';

export type FutsalCourtStatus = 'active' | 'maintenance' | 'draft';

export type FutsalLinkedTwinKind = 'futsal_court' | 'cricket_court';
export type FutsalCeilingUnit = 'ft' | 'm';
export type FutsalCoveredType = 'open' | 'semi_covered' | 'fully_indoor';
export type FutsalBoundaryType = 'net' | 'wall';
export type FutsalLighting = 'led_floodlights' | 'mixed' | 'daylight';
export type FutsalSurfaceType = 'artificial_turf' | 'hard_surface';
export type FutsalFormat = '5v5' | '6v6' | '7v7';
export type FutsalLineMarkings = 'permanent' | 'temporary';

@Entity({ name: 'futsal_courts' })
export class FutsalCourt {
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
  courtStatus!: FutsalCourtStatus;

  @Column({ type: 'jsonb', nullable: true })
  imageUrls?: string[];

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  ceilingHeightValue?: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  ceilingHeightUnit?: FutsalCeilingUnit;

  @Column({ type: 'varchar', length: 20, nullable: true })
  coveredType?: FutsalCoveredType;

  @Column({ type: 'boolean', nullable: true })
  sideNetting?: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  netHeight?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  boundaryType?: FutsalBoundaryType;

  @Column({ type: 'jsonb', nullable: true })
  ventilation?: string[];

  @Column({ type: 'varchar', length: 24, nullable: true })
  lighting?: FutsalLighting;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  lengthM?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  widthM?: string;

  @Column({ type: 'varchar', length: 24, nullable: true })
  surfaceType?: FutsalSurfaceType;

  @Column({ type: 'varchar', length: 120, nullable: true })
  turfQuality?: string;

  @Column({ type: 'boolean', nullable: true })
  shockAbsorptionLayer?: boolean;

  @Column({ type: 'varchar', length: 8, nullable: true })
  futsalFormat?: FutsalFormat;

  @Column({ type: 'boolean', nullable: true })
  futsalGoalPostsAvailable?: boolean;

  @Column({ type: 'varchar', length: 80, nullable: true })
  futsalGoalPostSize?: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  futsalLineMarkings?: FutsalLineMarkings;

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

  /** When set with {@link linkedTwinCourtId}, bookings on this pitch share the calendar with the linked cricket pitch. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  linkedTwinCourtKind?: FutsalLinkedTwinKind;

  @Column({ type: 'uuid', nullable: true })
  linkedTwinCourtId?: string;

  /**
   * When true, this row is the single DB record for a dual futsal+cricket turf; cricket APIs
   * resolve the same {@link id} as a cricket surface (no `cricket_courts` row).
   */
  @Column({ type: 'boolean', default: false })
  supportsCricket!: boolean;

  @Column({ type: 'varchar', length: 16, nullable: true })
  cricketFormat?: CricketFormat;

  @Column({ type: 'boolean', nullable: true })
  cricketStumpsAvailable?: boolean;

  @Column({ type: 'boolean', nullable: true })
  cricketBowlingMachine?: boolean;

  @Column({ type: 'varchar', length: 16, nullable: true })
  cricketPracticeMode?: CricketPracticeMode;

  /** Optional named list of hourly slot starts for booking UI (see tenant time slot templates). */
  @Column({ type: 'uuid', nullable: true })
  timeSlotTemplateId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  amenities?: ArenaAmenities;

  @Column({ type: 'jsonb', nullable: true })
  rules?: ArenaRules;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
