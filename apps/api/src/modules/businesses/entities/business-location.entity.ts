import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Business } from './business.entity';

@Entity({ name: 'business_locations' })
export class BusinessLocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  businessId!: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business!: Business;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  /** What this site is used for (arena, branch, hq, …). Assigned per location. */
  @Column({ type: 'varchar', length: 80, default: 'other' })
  locationType!: string;

  /** Court / sub-facility kinds offered at this site (e.g. padel-court). */
  @Column('text', { array: true, default: '{}' })
  facilityTypes!: string[];

  @Column({ type: 'varchar', length: 400, nullable: true })
  addressLine?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  area?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  country?: string;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  latitude?: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  longitude?: number;

  @Column({ type: 'varchar', length: 60, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  manager?: string;

  @Column({ type: 'jsonb', nullable: true })
  workingHours?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 80, nullable: true })
  timezone?: string;

  @Column({ type: 'varchar', length: 8, default: 'PKR' })
  currency!: string;

  /** Main image URL for this site (e.g. branch hero / listing thumbnail). */
  @Column({ type: 'varchar', length: 2048, nullable: true })
  logo?: string | null;

  /** Additional image URLs for this location. */
  @Column('text', { array: true, default: '{}' })
  gallery!: string[];

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
