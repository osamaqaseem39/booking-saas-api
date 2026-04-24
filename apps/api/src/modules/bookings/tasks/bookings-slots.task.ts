import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, LessThanOrEqual, Repository } from 'typeorm';
import { BookingsService } from '../bookings.service';
import { PadelCourt } from '../../arena/padel-court/entities/padel-court.entity';
import { TurfCourt } from '../../arena/turf/entities/turf-court.entity';
import { CourtFacilitySlot } from '../entities/court-facility-slot.entity';

@Injectable()
export class BookingsSlotsTask {
  private readonly logger = new Logger(BookingsSlotsTask.name);
  private readonly slotsTimeZone = 'Asia/Karachi';

  constructor(
    private readonly bookingsService: BookingsService,
    @InjectRepository(PadelCourt)
    private readonly padelRepo: Repository<PadelCourt>,
    @InjectRepository(TurfCourt)
    private readonly turfRepo: Repository<TurfCourt>,
    @InjectRepository(CourtFacilitySlot)
    private readonly facilitySlotRepo: Repository<CourtFacilitySlot>,
  ) {}

  private getCurrentSlotDateTime() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.slotsTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    const hh = parts.find((p) => p.type === 'hour')?.value;
    const mm = parts.find((p) => p.type === 'minute')?.value;

    return {
      today: `${y}-${m}-${d}`,
      currentTime: `${hh}:${mm}`,
    };
  }

  private async cleanupPastFacilitySlots(includePastTimesToday = false) {
    const { today, currentTime } = this.getCurrentSlotDateTime();
    const deleteOlderDateResult = await this.facilitySlotRepo.delete({
      slotDate: LessThan(today),
    });

    let deletedCount = deleteOlderDateResult.affected ?? 0;
    if (includePastTimesToday) {
      const deletePastTimeTodayResult = await this.facilitySlotRepo.delete({
        slotDate: today,
        endTime: LessThanOrEqual(currentTime),
      });
      deletedCount += deletePastTimeTodayResult.affected ?? 0;
    }

    this.logger.log(
      `Cleaned up ${deletedCount} expired facility slots (today=${today}, now=${currentTime}).`,
    );
  }

  /**
   * Run every day at midnight to:
   * 1. Delete past slots.
   * 2. Populate slots for the next 30 days.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleSlotMaintenance() {
    this.logger.log('Starting daily slot maintenance task...');

    // 1. Cleanup past slots (older than today)
    try {
      await this.cleanupPastFacilitySlots();
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

  /**
   * Run every 15 minutes to:
   * Mark confirmed bookings as completed if their slot time has ended.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleBookingCompletion() {
    this.logger.log('Starting booking completion task...');
    try {
      await this.bookingsService.completePastBookings();
    } catch (err) {
      this.logger.error('Failed to complete past bookings', err);
    }
  }

  /**
   * Run every 10 minutes to:
   * Delete expired facility slots for both past days and elapsed time today.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleExpiredFacilitySlotCleanup() {
    this.logger.log('Starting expired facility slot cleanup task...');
    try {
      await this.cleanupPastFacilitySlots(true);
    } catch (err) {
      this.logger.error('Failed expired facility slot cleanup', err);
    }
  }
}
