import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { BookingsService } from '../bookings.service';
import { PadelCourt } from '../../arena/padel-court/entities/padel-court.entity';
import { TurfCourt } from '../../arena/turf/entities/turf-court.entity';
import { CourtFacilitySlot } from '../entities/court-facility-slot.entity';

@Injectable()
export class BookingsSlotsTask {
  private readonly logger = new Logger(BookingsSlotsTask.name);

  constructor(
    private readonly bookingsService: BookingsService,
    @InjectRepository(PadelCourt)
    private readonly padelRepo: Repository<PadelCourt>,
    @InjectRepository(TurfCourt)
    private readonly turfRepo: Repository<TurfCourt>,
    @InjectRepository(CourtFacilitySlot)
    private readonly facilitySlotRepo: Repository<CourtFacilitySlot>,
  ) {}

  /**
   * Run every day at midnight to:
   * 1. Delete past slots.
   * 2. Populate slots for the next 30 days.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleSlotMaintenance() {
    this.logger.log('Starting daily slot maintenance task...');

    const today = new Date().toISOString().slice(0, 10);

    // 1. Cleanup past slots (older than today)
    try {
      const deleteResult = await this.facilitySlotRepo.delete({
        slotDate: LessThan(today),
      });
      this.logger.log(
        `Cleaned up ${deleteResult.affected ?? 0} past booking slots.`,
      );
    } catch (err) {
      this.logger.error('Failed to cleanup past slots', err);
    }

    // 2. Generate slots for next 30 days
    try {
      const padelCourts = await this.padelRepo.find({
        where: { isActive: true, courtStatus: 'active' },
        select: ['id', 'tenantId', 'timeSlotTemplateId'],
      });

      const turfCourts = await this.turfRepo.find({
        where: { status: 'active' },
        select: ['id', 'tenantId', 'timeSlotTemplateId'],
      });

      const datesToGenerate: string[] = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        datesToGenerate.push(d.toISOString().slice(0, 10));
      }

      let totalUpserted = 0;

      // Process Padel Courts
      for (const court of padelCourts) {
        if (!court.timeSlotTemplateId) continue;
        for (const date of datesToGenerate) {
          try {
            const res = await this.bookingsService.generateDayFacilitySlots(
              court.tenantId,
              {
                kind: 'padel_court',
                courtId: court.id,
                date,
              },
            );
            totalUpserted += res.upserted;
          } catch (slotErr) {
            this.logger.error(
              `Failed to generate slots for Padel court ${court.id} on ${date}`,
              slotErr,
            );
          }
        }
      }

      // Process Turf Courts
      for (const court of turfCourts) {
        if (!court.timeSlotTemplateId) continue;
        for (const date of datesToGenerate) {
          try {
            const res = await this.bookingsService.generateDayFacilitySlots(
              court.tenantId,
              {
                kind: 'turf_court',
                courtId: court.id,
                date,
              },
            );
            totalUpserted += res.upserted;
          } catch (slotErr) {
            this.logger.error(
              `Failed to generate slots for Turf court ${court.id} on ${date}`,
              slotErr,
            );
          }
        }
      }

      this.logger.log(
        `Finished slot generation. Total slots processed/upserted: ${totalUpserted}`,
      );
    } catch (err) {
      this.logger.error('Failed during slot generation loop', err);
    }

    this.logger.log('Daily slot maintenance task completed.');
  }
}
