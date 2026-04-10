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

export type GamingSetupCode =
  | 'gaming-pc'
  | 'gaming-ps5'
  | 'gaming-ps4'
  | 'gaming-xbox-one'
  | 'gaming-xbox-360'
  | 'gaming-vr'
  | 'gaming-steering-sim';

export type GamingUnitStatus = 'active' | 'maintenance' | 'draft';

@Entity({ name: 'gaming_stations' })
export class GamingStation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  businessLocationId!: string;

  @ManyToOne(() => BusinessLocation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessLocationId' })
  businessLocation!: BusinessLocation;

  @Column({ type: 'varchar', length: 40 })
  setupCode!: GamingSetupCode;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  unitStatus!: GamingUnitStatus;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  imageUrls?: string[];

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  pricePerSlot?: string;

  @Column({ type: 'jsonb', nullable: true })
  peakPricing?: {
    weekdayEvening?: number;
    weekend?: number;
  };

  @Column({ type: 'text', nullable: true })
  bundleNote?: string;

  @Column({ type: 'int', nullable: true })
  slotDurationMinutes?: number;

  @Column({ type: 'int', nullable: true })
  bufferBetweenSlotsMinutes?: number;

  @Column({ type: 'jsonb', nullable: true })
  amenities?: {
    snacksNearby?: boolean;
    extraControllers?: boolean;
    streamingCapture?: boolean;
  };

  @Column({ type: 'jsonb', nullable: true })
  specs?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
