import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Business } from '../businesses/entities/business.entity';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { TurfCourt } from '../turf/entities/turf-court.entity';
import { TurfSlotGeneratorService } from '../turf-availability/turf-slot-generator.service';
import { CreateTurfBookingDto } from './dto/create-turf-booking.dto';
import { TurfBooking } from './entities/turf-booking.entity';

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function toDec(n: number): string {
  return Number(n).toFixed(2);
}

@Injectable()
export class TurfBookingService {
  constructor(
    @InjectRepository(TurfBooking)
    private readonly turfBookingRepo: Repository<TurfBooking>,
    @InjectRepository(TurfCourt)
    private readonly turfRepo: Repository<TurfCourt>,
    @InjectRepository(BusinessLocation)
    private readonly locationRepo: Repository<BusinessLocation>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    private readonly slotGenerator: TurfSlotGeneratorService,
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

    const startDate = addDays(dto.bookingDate.slice(0, 10), selected.startDayOffset);
    const endDate = addDays(dto.bookingDate.slice(0, 10), selected.endDayOffset);
    const payload = this.turfBookingRepo.create({
      tenantId: business.tenantId,
      branchId: turf.branchId,
      turfId: turf.id,
      bookingDate: dto.bookingDate.slice(0, 10),
      sportType: dto.sportType,
      slotStartTime: selected.startTime,
      slotEndTime: selected.endTime,
      startDatetime: new Date(`${startDate}T${selected.startTime}:00Z`),
      endDatetime: new Date(`${endDate}T${selected.endTime}:00Z`),
      totalAmount: toDec(dto.totalAmount),
      bookingStatus: dto.bookingStatus ?? 'pending',
      paymentStatus: dto.paymentStatus ?? 'pending',
    });

    try {
      const saved = await this.turfBookingRepo.save(payload);
      return {
        id: saved.id,
        turfId: saved.turfId,
        bookingDate: saved.bookingDate,
        sportType: saved.sportType,
        slot: {
          startTime: saved.slotStartTime,
          endTime: saved.slotEndTime,
        },
        startDateTime: saved.startDatetime.toISOString(),
        endDateTime: saved.endDatetime.toISOString(),
        totalAmount: Number(saved.totalAmount),
        bookingStatus: saved.bookingStatus,
        paymentStatus: saved.paymentStatus,
      };
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        typeof (error as any).driverError?.code === 'string' &&
        (error as any).driverError.code === '23505'
      ) {
        throw new BadRequestException('Selected slot is already booked');
      }
      throw error;
    }
  }
}
