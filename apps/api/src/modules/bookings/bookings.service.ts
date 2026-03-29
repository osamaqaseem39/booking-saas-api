import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CricketIndoorCourt } from '../arena/cricket-indoor/entities/cricket-indoor-court.entity';
import { FutsalField } from '../arena/futsal-field/entities/futsal-field.entity';
import { PadelCourt } from '../arena/padel-court/entities/padel-court.entity';
import { TurfCourt } from '../arena/turf-court/entities/turf-court.entity';
import { turfSportModeToFlags } from '../arena/turf-court/turf-sport-mode.util';
import { User } from '../iam/entities/user.entity';
import type {
  BookingItemStatus,
  BookingSportType,
  BookingStatus,
  CourtKind,
  PaymentMethod,
  PaymentStatus,
} from './booking.types';
import type { CreateBookingDto } from './dto/create-booking.dto';
import type { CreateBookingItemDto } from './dto/create-booking-item.dto';
import type { UpdateBookingDto } from './dto/update-booking.dto';
import { Booking } from './entities/booking.entity';

function dec(n: number): string {
  return Number(n).toFixed(2);
}

function numFromDec(v: string): number {
  return Number.parseFloat(v);
}

function formatDateOnly(d: Date | string): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

export type BookingApiRow = {
  bookingId: string;
  arenaId: string;
  userId: string;
  sportType: BookingSportType;
  bookingDate: string;
  items: Array<{
    id: string;
    courtKind: CourtKind;
    courtId: string;
    slotId?: string;
    startTime: string;
    endTime: string;
    price: number;
    currency: string;
    status: BookingItemStatus;
  }>;
  pricing: {
    subTotal: number;
    discount: number;
    tax: number;
    totalAmount: number;
  };
  payment: {
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    transactionId?: string;
    paidAt?: string;
  };
  bookingStatus: BookingStatus;
  notes?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(TurfCourt)
    private readonly turfRepo: Repository<TurfCourt>,
    @InjectRepository(FutsalField)
    private readonly futsalRepo: Repository<FutsalField>,
    @InjectRepository(PadelCourt)
    private readonly padelRepo: Repository<PadelCourt>,
    @InjectRepository(CricketIndoorCourt)
    private readonly cricketRepo: Repository<CricketIndoorCourt>,
  ) {}

  private toApi(booking: Booking): BookingApiRow {
    return {
      bookingId: booking.id,
      arenaId: booking.tenantId,
      userId: booking.userId,
      sportType: booking.sportType as BookingSportType,
      bookingDate: formatDateOnly(booking.bookingDate),
      items: (booking.items ?? []).map((it) => ({
        id: it.id,
        courtKind: it.courtKind,
        courtId: it.courtId,
        slotId: it.slotId,
        startTime: it.startTime,
        endTime: it.endTime,
        price: numFromDec(it.price),
        currency: it.currency,
        status: it.itemStatus,
      })),
      pricing: {
        subTotal: numFromDec(booking.subTotal),
        discount: numFromDec(booking.discount),
        tax: numFromDec(booking.tax),
        totalAmount: numFromDec(booking.totalAmount),
      },
      payment: {
        paymentStatus: booking.paymentStatus as PaymentStatus,
        paymentMethod: booking.paymentMethod as PaymentMethod,
        transactionId: booking.transactionId,
        paidAt: booking.paidAt?.toISOString(),
      },
      bookingStatus: booking.bookingStatus as BookingStatus,
      notes: booking.notes,
      cancellationReason: booking.cancellationReason,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    };
  }

  async list(tenantId: string): Promise<BookingApiRow[]> {
    const rows = await this.bookingRepo.find({
      where: { tenantId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
    return rows.map((b) => this.toApi(b));
  }

  async getOne(tenantId: string, bookingId: string): Promise<BookingApiRow> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId, tenantId },
      relations: ['items'],
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }
    return this.toApi(booking);
  }

  async create(tenantId: string, dto: CreateBookingDto): Promise<BookingApiRow> {
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) {
      throw new BadRequestException(`User ${dto.userId} not found`);
    }

    for (const item of dto.items) {
      await this.assertCourtValidForSport(tenantId, dto.sportType, item);
    }

    const paidAt = dto.payment.paidAt
      ? new Date(dto.payment.paidAt)
      : undefined;

    const booking = this.bookingRepo.create({
      tenantId,
      userId: dto.userId,
      sportType: dto.sportType,
      bookingDate: dto.bookingDate,
      subTotal: dec(dto.pricing.subTotal),
      discount: dec(dto.pricing.discount),
      tax: dec(dto.pricing.tax),
      totalAmount: dec(dto.pricing.totalAmount),
      paymentStatus: dto.payment.paymentStatus,
      paymentMethod: dto.payment.paymentMethod,
      transactionId: dto.payment.transactionId,
      paidAt,
      bookingStatus: dto.bookingStatus ?? 'pending',
      notes: dto.notes,
      items: dto.items.map((i) => ({
        courtKind: i.courtKind,
        courtId: i.courtId,
        slotId: i.slotId,
        startTime: i.startTime,
        endTime: i.endTime,
        price: dec(i.price),
        currency: i.currency ?? 'PKR',
        itemStatus: i.status,
      })),
    });

    const saved = await this.bookingRepo.save(booking);
    const full = await this.bookingRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ['items'],
    });
    return this.toApi(full);
  }

  async update(
    tenantId: string,
    bookingId: string,
    dto: UpdateBookingDto,
  ): Promise<BookingApiRow> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId, tenantId },
      relations: ['items'],
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    if (dto.bookingStatus !== undefined) {
      booking.bookingStatus = dto.bookingStatus;
    }
    if (dto.notes !== undefined) {
      booking.notes = dto.notes;
    }
    if (dto.cancellationReason !== undefined) {
      booking.cancellationReason = dto.cancellationReason;
    }

    if (dto.payment) {
      if (dto.payment.paymentStatus !== undefined) {
        booking.paymentStatus = dto.payment.paymentStatus;
      }
      if (dto.payment.paymentMethod !== undefined) {
        booking.paymentMethod = dto.payment.paymentMethod;
      }
      if (dto.payment.transactionId !== undefined) {
        booking.transactionId = dto.payment.transactionId;
      }
      if (dto.payment.paidAt !== undefined) {
        booking.paidAt = dto.payment.paidAt
          ? new Date(dto.payment.paidAt)
          : undefined;
      }
    }

    if (dto.itemStatuses?.length) {
      const byId = new Map(booking.items.map((i) => [i.id, i]));
      for (const row of dto.itemStatuses) {
        const item = byId.get(row.itemId);
        if (!item) {
          throw new BadRequestException(`Item ${row.itemId} not in this booking`);
        }
        item.itemStatus = row.status;
      }
    }

    await this.bookingRepo.save(booking);
    return this.getOne(tenantId, bookingId);
  }

  private async assertCourtValidForSport(
    tenantId: string,
    sport: BookingSportType,
    item: CreateBookingItemDto,
  ): Promise<void> {
    const { courtKind, courtId } = item;

    if (sport === 'padel' && courtKind !== 'padel_court') {
      throw new BadRequestException(
        'padel bookings require courtKind padel_court',
      );
    }
    if (sport === 'futsal' && courtKind === 'padel_court') {
      throw new BadRequestException('futsal booking cannot use a padel court');
    }
    if (sport === 'futsal' && courtKind === 'cricket_indoor_court') {
      throw new BadRequestException(
        'futsal booking cannot use cricket_indoor_court',
      );
    }
    if (sport === 'cricket' && courtKind === 'padel_court') {
      throw new BadRequestException('cricket booking cannot use a padel court');
    }
    if (sport === 'cricket' && courtKind === 'futsal_field') {
      throw new BadRequestException(
        'cricket booking cannot use futsal_field',
      );
    }

    switch (courtKind) {
      case 'turf_court': {
        const turf = await this.turfRepo.findOne({
          where: { id: courtId, tenantId },
        });
        if (!turf) {
          throw new BadRequestException(
            `Turf court ${courtId} not found for this tenant`,
          );
        }
        const flags = turfSportModeToFlags(turf.sportMode);
        if (sport === 'futsal' && !flags.supportsFutsal) {
          throw new BadRequestException(
            `Turf court ${courtId} does not support futsal`,
          );
        }
        if (sport === 'cricket' && !flags.supportsCricket) {
          throw new BadRequestException(
            `Turf court ${courtId} does not support cricket`,
          );
        }
        if (sport === 'padel') {
          throw new BadRequestException('padel cannot use turf_court');
        }
        break;
      }
      case 'futsal_field': {
        const row = await this.futsalRepo.findOne({
          where: { id: courtId, tenantId },
        });
        if (!row) {
          throw new BadRequestException(
            `Futsal field ${courtId} not found for this tenant`,
          );
        }
        break;
      }
      case 'padel_court': {
        const row = await this.padelRepo.findOne({
          where: { id: courtId, tenantId },
        });
        if (!row) {
          throw new BadRequestException(
            `Padel court ${courtId} not found for this tenant`,
          );
        }
        break;
      }
      case 'cricket_indoor_court': {
        const row = await this.cricketRepo.findOne({
          where: { id: courtId, tenantId },
        });
        if (!row) {
          throw new BadRequestException(
            `Cricket indoor court ${courtId} not found for this tenant`,
          );
        }
        break;
      }
    }
  }
}
