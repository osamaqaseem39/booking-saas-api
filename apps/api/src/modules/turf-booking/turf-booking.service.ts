import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../businesses/entities/business.entity';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { BookingsService } from '../bookings/bookings.service';
import { TurfCourt } from '../arena/turf/entities/turf-court.entity';
import { TurfSlotGeneratorService } from '../turf-availability/turf-slot-generator.service';
import { CreateTurfBookingDto } from './dto/create-turf-booking.dto';

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class TurfBookingService {
  constructor(
    @InjectRepository(TurfCourt)
    private readonly turfRepo: Repository<TurfCourt>,
    @InjectRepository(BusinessLocation)
    private readonly locationRepo: Repository<BusinessLocation>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    private readonly slotGenerator: TurfSlotGeneratorService,
    private readonly bookingsService: BookingsService,
  ) {}

  async create(dto: CreateTurfBookingDto) {
    const turf = await this.turfRepo.findOne({ where: { id: dto.turfId } });
    if (!turf) throw new NotFoundException(`Turf ${dto.turfId} not found`);
    if (turf.status !== 'active') throw new BadRequestException('Selected turf is not active');
    if (!turf.supportedSports.includes(dto.sportType)) {
      throw new BadRequestException(`Turf does not support ${dto.sportType}`);
    }

    const branch = await this.locationRepo.findOne({ where: { id: turf.branchId } });
    if (!branch) throw new BadRequestException('Branch not found for selected turf');
    const business = await this.businessRepo.findOne({
      where: { id: branch.businessId },
      select: ['tenantId'],
    });
    if (!business) throw new BadRequestException('Tenant could not be resolved');

    const slots = this.slotGenerator.generateSlots({
      branch,
      bookingDate: dto.bookingDate.slice(0, 10),
      slotDuration: turf.slotDuration,
      bufferTime: turf.bufferTime,
    });
    const selected = slots.find(
      (s) =>
        s.startTime === dto.slot.startTime &&
        s.endTime === dto.slot.endTime,
    );
    if (!selected) {
      throw new BadRequestException(
        'Invalid slot. Only generated fixed slots can be booked.',
      );
    }

    const startDate = addDays(
      dto.bookingDate.slice(0, 10),
      selected.startDayOffset,
    );
    const endDate = addDays(dto.bookingDate.slice(0, 10), selected.endDayOffset);
    const booking = await this.bookingsService.create(business.tenantId, {
      userId: dto.userId,
      sportType: dto.sportType,
      bookingDate: dto.bookingDate.slice(0, 10),
      items: [
        {
          courtKind: 'turf_court',
          courtId: turf.id,
          startTime: selected.startTime,
          endTime: selected.endTime,
          price: dto.totalAmount,
          currency: branch.currency ?? 'PKR',
          status: 'reserved',
        },
      ],
      pricing: {
        subTotal: dto.totalAmount,
        discount: 0,
        tax: 0,
        totalAmount: dto.totalAmount,
      },
      payment: {
        paymentStatus: dto.paymentStatus ?? 'pending',
        paymentMethod: 'cash',
      },
      bookingStatus: dto.bookingStatus ?? 'pending',
    });
    return {
      id: booking.bookingId,
      turfId: turf.id,
      bookingDate: booking.bookingDate,
      sportType: booking.sportType,
      slot: {
        startTime: selected.startTime,
        endTime: selected.endTime,
      },
      startDateTime: `${startDate}T${selected.startTime}:00.000Z`,
      endDateTime: `${endDate}T${selected.endTime}:00.000Z`,
      totalAmount: dto.totalAmount,
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.payment.paymentStatus,
    };
  }
}
