import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { TurfCourt } from '../turf/entities/turf-court.entity';
import { TurfSportType } from '../turf/turf.types';
import { TurfBooking } from '../turf-booking/entities/turf-booking.entity';
import { TurfSlotGeneratorService } from './turf-slot-generator.service';

@Injectable()
export class TurfAvailabilityService {
  constructor(
    @InjectRepository(TurfCourt)
    private readonly turfRepo: Repository<TurfCourt>,
    @InjectRepository(BusinessLocation)
    private readonly locationRepo: Repository<BusinessLocation>,
    @InjectRepository(TurfBooking)
    private readonly bookingRepo: Repository<TurfBooking>,
    private readonly slotGenerator: TurfSlotGeneratorService,
  ) {}

  async getAvailability(params: {
    branchId: string;
    date: string;
    sportType: TurfSportType;
  }) {
    const date = params.date.slice(0, 10);
    const branch = await this.locationRepo.findOne({ where: { id: params.branchId } });
    if (!branch) {
      return { date, turfs: [] };
    }

    const turfs = await this.turfRepo
      .createQueryBuilder('t')
      .where('t."branchId" = :branchId', { branchId: params.branchId })
      .andWhere('t.status = :status', { status: 'active' })
      .andWhere(':sportType = ANY(t."supportedSports")', {
        sportType: params.sportType,
      })
      .orderBy('t.name', 'ASC')
      .getMany();

    if (turfs.length === 0) return { date, turfs: [] };

    const bookings = await this.bookingRepo.find({
      where: {
        turfId: In(turfs.map((t) => t.id)),
        bookingDate: date,
        bookingStatus: In(['pending', 'confirmed']),
      },
      select: ['turfId', 'slotStartTime', 'slotEndTime'],
    });

    const bookedMap = new Map<string, Set<string>>();
    for (const row of bookings) {
      const key = `${row.slotStartTime}-${row.slotEndTime}`;
      const turfSet = bookedMap.get(row.turfId) ?? new Set<string>();
      turfSet.add(key);
      bookedMap.set(row.turfId, turfSet);
    }

    return {
      date,
      turfs: turfs.map((turf) => {
        const generatedSlots = this.slotGenerator.generateSlots({
          branch,
          bookingDate: date,
          slotDuration: turf.slotDuration,
          bufferTime: turf.bufferTime,
        });
        const turfBooked = bookedMap.get(turf.id) ?? new Set<string>();
        return {
          turfId: turf.id,
          name: turf.name,
          config: (turf.sportConfig as any)?.[params.sportType] ?? {},
          pricing: (turf.pricing as any)?.[params.sportType] ?? {},
          slots: generatedSlots.map((s) => ({
            startTime: s.startTime,
            endTime: s.endTime,
            status: turfBooked.has(`${s.startTime}-${s.endTime}`)
              ? 'booked'
              : 'available',
          })),
        };
      }),
    };
  }
}
