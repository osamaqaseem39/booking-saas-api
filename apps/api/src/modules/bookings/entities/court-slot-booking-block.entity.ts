import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { CourtKind } from '../types/booking.types';

/**
 * Admin-disabled hourly booking window for a court on a calendar date.
 * Presence of a row = booking is turned off for that segment start (HH:mm).
 */
@Entity({ name: 'court_slot_booking_blocks' })
export class CourtSlotBookingBlock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 32 })
  courtKind!: CourtKind;

  @Column({ type: 'uuid' })
  courtId!: string;

  @Column({ type: 'date' })
  blockDate!: string;

  /** Start of the hourly segment (HH:mm, 24h). */
  @Column({ type: 'varchar', length: 5 })
  startTime!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
