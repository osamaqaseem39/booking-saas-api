import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { BookingItemStatus, CourtKind } from '../types/booking.types';
import { Booking } from './booking.entity';

@Entity({ name: 'booking_items' })
export class BookingItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  bookingId!: string;

  @ManyToOne(() => Booking, (b) => b.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking!: Booking;

  /** Which table `courtId` references (`padel_courts`). */
  @Column({ type: 'varchar', length: 32 })
  courtKind!: CourtKind;

  @Column({ type: 'uuid' })
  courtId!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  slotId?: string;

  @Column({ type: 'varchar', length: 5 })
  startTime!: string;

  @Column({ type: 'varchar', length: 5 })
  endTime!: string;

  @Column({ type: 'timestamptz', nullable: true })
  startDatetime?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endDatetime?: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price!: string;

  @Column({ type: 'varchar', length: 8, default: 'PKR' })
  currency!: string;

  @Column({ type: 'varchar', length: 20 })
  itemStatus!: BookingItemStatus;
}
