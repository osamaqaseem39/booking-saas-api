import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { CourtKind } from '../types/booking.types';

export type CourtFacilitySlotStatus = 'available' | 'blocked';

@Entity({ name: 'court_facility_slots' })
@Unique('UQ_court_facility_slots_key', [
  'tenantId',
  'courtKind',
  'courtId',
  'slotDate',
  'startTime',
])
export class CourtFacilitySlot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 32 })
  courtKind!: CourtKind;

  @Column({ type: 'uuid' })
  courtId!: string;

  @Column({ type: 'date' })
  slotDate!: string;

  @Column({ type: 'varchar', length: 5 })
  startTime!: string;

  @Column({ type: 'varchar', length: 5 })
  endTime!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: CourtFacilitySlotStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
