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
  PadelAmenities,
  PadelExtras,
  PadelPeakPricing,
  PadelRules,
} from '../padel-court.types';

export type PadelCourtStatus = 'active' | 'maintenance';
export type PadelCeilingUnit = 'ft' | 'm';
export type PadelCoveredType = 'indoor' | 'semi_covered';
export type PadelWallType = 'full_glass' | 'glass_mesh';
export type PadelSurfaceType = 'synthetic_turf' | 'acrylic';
export type PadelMatchType = 'singles' | 'doubles';

@Entity({ name: 'padel_courts' })
export class PadelCourt {
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
  courtStatus!: PadelCourtStatus;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  imageUrls?: string[];

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  ceilingHeightValue?: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  ceilingHeightUnit?: PadelCeilingUnit;

  @Column({ type: 'varchar', length: 20, nullable: true })
  coveredType?: PadelCoveredType;

  @Column({ type: 'boolean', default: true })
  glassWalls!: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  wallType?: PadelWallType;

  @Column({ type: 'varchar', length: 80, nullable: true })
  lighting?: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  ventilation?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  lengthM?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  widthM?: string;

  @Column({ type: 'varchar', length: 24, nullable: true })
  surfaceType?: PadelSurfaceType | string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  matchType?: PadelMatchType;

  @Column({ type: 'int', nullable: true })
  maxPlayers?: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  pricePerSlot?: string;

  @Column({ type: 'jsonb', nullable: true })
  peakPricing?: PadelPeakPricing;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  membershipPrice?: string;

  @Column({ type: 'int', nullable: true })
  slotDurationMinutes?: number;

  @Column({ type: 'int', nullable: true })
  bufferBetweenSlotsMinutes?: number;

  @Column({ type: 'jsonb', nullable: true })
  extras?: PadelExtras;

  @Column({ type: 'jsonb', nullable: true })
  amenities?: PadelAmenities;

  @Column({ type: 'jsonb', nullable: true })
  rules?: PadelRules;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
