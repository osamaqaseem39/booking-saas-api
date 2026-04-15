import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { TurfSportType } from '../../turf/turf.types';

export const TURF_BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled'] as const;
export type TurfBookingStatus = (typeof TURF_BOOKING_STATUSES)[number];

export const TURF_PAYMENT_STATUSES = ['pending', 'paid', 'failed'] as const;
export type TurfPaymentStatus = (typeof TURF_PAYMENT_STATUSES)[number];

@Entity({ name: 'turf_bookings' })
@Unique('uq_turf_bookings_turf_start_datetime', ['turfId', 'startDatetime'])
export class TurfBooking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  branchId!: string;

  @Column({ type: 'uuid' })
  turfId!: string;

  @Column({ type: 'date' })
  bookingDate!: string;

  @Column({ type: 'varchar', length: 16 })
  sportType!: TurfSportType;

  @Column({ type: 'time' })
  slotStartTime!: string;

  @Column({ type: 'time' })
  slotEndTime!: string;

  @Column({ type: 'timestamptz' })
  startDatetime!: Date;

  @Column({ type: 'timestamptz' })
  endDatetime!: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  bookingStatus!: TurfBookingStatus;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  paymentStatus!: TurfPaymentStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
