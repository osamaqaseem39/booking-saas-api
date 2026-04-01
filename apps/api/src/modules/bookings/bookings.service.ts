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

function isPastDate(dateOnly: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dateOnly < today;
}

function toMinutes(time: string): number {
  const [hRaw, mRaw] = time.split(':');
  const h = Number(hRaw || 0);
  const m = Number(mRaw || 0);
  return h * 60 + m;
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

type CourtOptionRow = {
  kind: CourtKind;
  id: string;
  name: string;
};

export type BookingAvailabilityApiRow = {
  date: string;
  startTime: string;
  endTime: string;
  sportType?: BookingSportType;
  availableCourts: CourtOptionRow[];
  bookedSlots: Array<{
    kind: CourtKind;
    courtId: string;
    startTime: string;
    endTime: string;
    bookingId: string;
    itemId: string;
    status: BookingItemStatus;
  }>;
};

export type CourtSlotsApiRow = {
  date: string;
  kind: CourtKind;
  courtId: string;
  slots: Array<{
    startTime: string;
    endTime: string;
    bookingId: string;
    itemId: string;
    status: BookingItemStatus;
  }>;
};

@Injectable()
export class BookingsService {
  private effectiveStatus(booking: Booking): BookingStatus {
    const current = booking.bookingStatus;
    if (current === 'cancelled' || current === 'completed' || current === 'no_show') {
      return current;
    }
    const bookingDay = formatDateOnly(booking.bookingDate);
    if (isPastDate(bookingDay)) return 'completed';
    return current;
  }

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
      sportType: booking.sportType,
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
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod,
        transactionId: booking.transactionId,
        paidAt: booking.paidAt?.toISOString(),
      },
      bookingStatus: this.effectiveStatus(booking),
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

  async create(
    tenantId: string,
    dto: CreateBookingDto,
  ): Promise<BookingApiRow> {
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) {
      throw new BadRequestException(`User ${dto.userId} not found`);
    }

    for (const item of dto.items) {
      this.assertFutureHalfHourBooking(dto.bookingDate, item);
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
          throw new BadRequestException(
            `Item ${row.itemId} not in this booking`,
          );
        }
        item.itemStatus = row.status;
      }
    }

    await this.bookingRepo.save(booking);
    return this.getOne(tenantId, bookingId);
  }

  async getAvailabilityByTime(
    tenantId: string,
    params: {
      date: string;
      startTime: string;
      endTime: string;
      sportType?: BookingSportType;
    },
  ): Promise<BookingAvailabilityApiRow> {
    const dateOnly = formatDateOnly(params.date);
    const courts = await this.listCourtsBySport(tenantId, params.sportType);
    const courtByKey = new Set(courts.map((c) => `${c.kind}:${c.id}`));
    const items = await this.listBookedItemsForDate(tenantId, dateOnly);
    const overlapping = items.filter(
      (it) =>
        this.timesOverlap(
          params.startTime,
          params.endTime,
          it.startTime,
          it.endTime,
        ) && courtByKey.has(`${it.courtKind}:${it.courtId}`),
    );
    const blocked = new Set(overlapping.map((it) => `${it.courtKind}:${it.courtId}`));
    return {
      date: dateOnly,
      startTime: params.startTime,
      endTime: params.endTime,
      sportType: params.sportType,
      availableCourts: courts.filter((c) => !blocked.has(`${c.kind}:${c.id}`)),
      bookedSlots: overlapping.map((it) => ({
        kind: it.courtKind,
        courtId: it.courtId,
        startTime: it.startTime,
        endTime: it.endTime,
        bookingId: it.bookingId,
        itemId: it.id,
        status: it.itemStatus,
      })),
    };
  }

  async getCourtSlots(
    tenantId: string,
    params: { kind: CourtKind; courtId: string; date: string },
  ): Promise<CourtSlotsApiRow> {
    const dateOnly = formatDateOnly(params.date);
    const rows = await this.listBookedItemsForDate(tenantId, dateOnly);
    const slots = rows
      .filter((it) => it.courtKind === params.kind && it.courtId === params.courtId)
      .map((it) => ({
        startTime: it.startTime,
        endTime: it.endTime,
        bookingId: it.bookingId,
        itemId: it.id,
        status: it.itemStatus,
      }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return {
      date: dateOnly,
      kind: params.kind,
      courtId: params.courtId,
      slots,
    };
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
      throw new BadRequestException('cricket booking cannot use futsal_field');
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

  private async listCourtsBySport(
    tenantId: string,
    sport?: BookingSportType,
  ): Promise<CourtOptionRow[]> {
    const out: CourtOptionRow[] = [];
    if (!sport || sport === 'futsal') {
      const [turf, futsal] = await Promise.all([
        this.turfRepo.find({
          where: { tenantId, courtStatus: 'active', supportsFutsal: true },
          select: ['id', 'name'],
        }),
        this.futsalRepo.find({
          where: { tenantId, isActive: true },
          select: ['id', 'name'],
        }),
      ]);
      out.push(
        ...turf.map((r) => ({ kind: 'turf_court' as const, id: r.id, name: r.name })),
      );
      out.push(
        ...futsal.map((r) => ({
          kind: 'futsal_field' as const,
          id: r.id,
          name: r.name,
        })),
      );
    }
    if (!sport || sport === 'cricket') {
      const [turf, indoor] = await Promise.all([
        this.turfRepo.find({
          where: { tenantId, courtStatus: 'active', supportsCricket: true },
          select: ['id', 'name'],
        }),
        this.cricketRepo.find({
          where: { tenantId, isActive: true },
          select: ['id', 'name'],
        }),
      ]);
      out.push(
        ...turf.map((r) => ({ kind: 'turf_court' as const, id: r.id, name: r.name })),
      );
      out.push(
        ...indoor.map((r) => ({
          kind: 'cricket_indoor_court' as const,
          id: r.id,
          name: r.name,
        })),
      );
    }
    if (!sport || sport === 'padel') {
      const rows = await this.padelRepo.find({
        where: { tenantId, isActive: true, courtStatus: 'active' },
        select: ['id', 'name'],
      });
      out.push(
        ...rows.map((r) => ({ kind: 'padel_court' as const, id: r.id, name: r.name })),
      );
    }
    const seen = new Set<string>();
    return out.filter((row) => {
      const key = `${row.kind}:${row.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async listBookedItemsForDate(tenantId: string, dateOnly: string) {
    return this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.items', 'i')
      .where('b.tenantId = :tenantId', { tenantId })
      .andWhere('b.bookingDate = :dateOnly', { dateOnly })
      .andWhere("b.bookingStatus != 'cancelled'")
      .andWhere("i.itemStatus != 'cancelled'")
      .select([
        'b.id AS bookingId',
        'i.id AS id',
        'i.courtKind AS courtKind',
        'i.courtId AS courtId',
        'i.startTime AS startTime',
        'i.endTime AS endTime',
        'i.itemStatus AS itemStatus',
      ])
      .getRawMany<{
        bookingId: string;
        id: string;
        courtKind: CourtKind;
        courtId: string;
        startTime: string;
        endTime: string;
        itemStatus: BookingItemStatus;
      }>();
  }

  private timesOverlap(
    startA: string,
    endA: string,
    startB: string,
    endB: string,
  ): boolean {
    return startA < endB && startB < endA;
  }

  private assertFutureHalfHourBooking(
    bookingDate: string,
    item: CreateBookingItemDto,
  ): void {
    const startMins = toMinutes(item.startTime);
    const endMins = toMinutes(item.endTime);
    if (endMins <= startMins) {
      throw new BadRequestException('endTime must be after startTime');
    }

    const duration = endMins - startMins;
    if (duration < 30) {
      throw new BadRequestException('Booking duration must be at least 30 minutes');
    }
    if (startMins % 30 !== 0 || endMins % 30 !== 0 || duration % 30 !== 0) {
      throw new BadRequestException(
        'startTime/endTime must be on 30-minute intervals',
      );
    }

    const startAt = new Date(`${bookingDate}T${item.startTime}:00`);
    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('Invalid bookingDate/startTime');
    }
    const minStart = new Date(Date.now() + 30 * 60 * 1000);
    if (startAt.getTime() < minStart.getTime()) {
      throw new BadRequestException(
        'Bookings must be scheduled at least 30 minutes in the future',
      );
    }
  }
}
