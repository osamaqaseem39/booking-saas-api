import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, In, Repository } from 'typeorm';
import { PadelCourt } from '../arena/padel-court/entities/padel-court.entity';
import { User } from '../iam/entities/user.entity';
import {
  COURT_SLOT_GRID_STEP_MINUTES,
  type BookingItemStatus,
  type BookingSportType,
  type BookingStatus,
  type CourtKind,
  type PaymentMethod,
  type PaymentStatus,
} from './booking.types';
import type { CreateBookingDto } from './dto/create-booking.dto';
import type { CreateBookingItemDto } from './dto/create-booking-item.dto';
import type { UpdateBookingDto } from './dto/update-booking.dto';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { Business } from '../businesses/entities/business.entity';
import type { PlacePadelBookingDto } from './dto/place-padel-booking.dto';
import { CourtFacilitySlot } from './entities/court-facility-slot.entity';
import { BookingItem } from './entities/booking-item.entity';
import { CourtSlotBookingBlock } from './entities/court-slot-booking-block.entity';
import { Booking } from './entities/booking.entity';
import { TenantTimeSlotTemplate } from './entities/tenant-time-slot-template.entity';

function dec(n: number): string {
  return Number(n).toFixed(2);
}

function numFromDec(v: string): number {
  return Number.parseFloat(v);
}

function toMinutes(time: string): number {
  const [hRaw, mRaw] = time.split(':');
  return Number(hRaw || 0) * 60 + Number(mRaw || 0);
}

function minutesToTimeString(m: number): string {
  if (m >= 24 * 60) return '24:00';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
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
  pricing: { subTotal: number; discount: number; tax: number; totalAmount: number };
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
    @InjectRepository(PadelCourt)
    private readonly padelRepo: Repository<PadelCourt>,
    @InjectRepository(BusinessLocation)
    private readonly locationRepo: Repository<BusinessLocation>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(CourtSlotBookingBlock)
    private readonly slotBlockRepo: Repository<CourtSlotBookingBlock>,
    @InjectRepository(CourtFacilitySlot)
    private readonly facilitySlotRepo: Repository<CourtFacilitySlot>,
    @InjectRepository(TenantTimeSlotTemplate)
    private readonly slotTemplateRepo: Repository<TenantTimeSlotTemplate>,
  ) {}

  async resolveTenantIdByCourt(kind: CourtKind, courtId: string): Promise<string | null> {
    if (kind !== 'padel_court') return null;
    const row = await this.padelRepo.findOne({ where: { id: courtId }, select: ['tenantId'] });
    return row?.tenantId ?? null;
  }

  async resolveTenantIdByBooking(bookingId: string): Promise<string | null> {
    const row = await this.bookingRepo.findOne({ where: { id: bookingId }, select: ['tenantId'] });
    return row?.tenantId ?? null;
  }

  async resolveTenantIdByTimeSlotTemplate(templateId: string): Promise<string | null> {
    const row = await this.slotTemplateRepo.findOne({ where: { id: templateId }, select: ['tenantId'] });
    return row?.tenantId ?? null;
  }

  async resolveTenantIdByLocation(locationId: string): Promise<string | null> {
    const loc = await this.locationRepo.findOne({ where: { id: locationId }, select: ['businessId'] });
    if (!loc) return null;
    const business = await this.businessRepo.findOne({ where: { id: loc.businessId }, select: ['tenantId'] });
    return business?.tenantId ?? null;
  }

  private toApi(booking: Booking): BookingApiRow {
    const first = booking.items?.[0];
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
      bookingStatus: booking.bookingStatus,
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

  async listByUserForProfile(userId: string): Promise<BookingApiRow[]> {
    const rows = await this.bookingRepo.find({
      where: { userId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
    return rows.map((b) => this.toApi(b));
  }

  async getOne(tenantId: string, bookingId: string): Promise<BookingApiRow> {
    const row = await this.bookingRepo.findOne({
      where: { id: bookingId, tenantId },
      relations: ['items'],
    });
    if (!row) throw new NotFoundException(`Booking ${bookingId} not found`);
    return this.toApi(row);
  }

  private async assertPadelCourtExists(tenantId: string, courtId: string): Promise<PadelCourt> {
    const court = await this.padelRepo.findOne({ where: { id: courtId, tenantId } });
    if (!court) throw new BadRequestException(`Court ${courtId} not found for this tenant`);
    if (court.courtStatus !== 'active' || court.isActive === false) {
      throw new BadRequestException('Selected court is not available');
    }
    return court;
  }

  private assertBookingItem(item: CreateBookingItemDto): void {
    if (item.courtKind !== 'padel_court') {
      throw new BadRequestException('Only padel_court is supported');
    }
    if (toMinutes(item.endTime) <= toMinutes(item.startTime)) {
      throw new BadRequestException('endTime must be after startTime');
    }
  }

  private async assertNoOverlap(tenantId: string, date: string, item: CreateBookingItemDto) {
    const overlaps = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.items', 'i')
      .where('b.tenantId = :tenantId', { tenantId })
      .andWhere('b.bookingDate = :date', { date: formatDateOnly(date) })
      .andWhere("b.bookingStatus = 'confirmed'")
      .andWhere("i.itemStatus = 'confirmed'")
      .andWhere('i.courtKind = :kind', { kind: 'padel_court' })
      .andWhere('i.courtId = :courtId', { courtId: item.courtId })
      .andWhere('i.startTime < :endTime', { endTime: item.endTime })
      .andWhere('i.endTime > :startTime', { startTime: item.startTime })
      .getCount();
    if (overlaps > 0) throw new BadRequestException('Selected slot is already booked');
  }

  async create(tenantId: string, dto: CreateBookingDto): Promise<BookingApiRow> {
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw new BadRequestException(`User ${dto.userId} not found`);
    if (dto.sportType !== 'padel') throw new BadRequestException('Only padel bookings are supported');

    for (const item of dto.items) {
      this.assertBookingItem(item);
      await this.assertPadelCourtExists(tenantId, item.courtId);
      await this.assertNoOverlap(tenantId, dto.bookingDate, item);
    }

    const itemsPayload: DeepPartial<BookingItem>[] = dto.items.map((i) => ({
      courtKind: 'padel_court',
      courtId: i.courtId,
      slotId: i.slotId,
      startTime: i.startTime,
      endTime: i.endTime,
      price: dec(i.price),
      currency: i.currency ?? 'PKR',
      itemStatus: i.status,
    }));

    const bookingPayload: DeepPartial<Booking> = {
      tenantId,
      userId: dto.userId,
      sportType: 'padel',
      bookingDate: formatDateOnly(dto.bookingDate),
      subTotal: dec(dto.pricing.subTotal),
      discount: dec(dto.pricing.discount),
      tax: dec(dto.pricing.tax),
      totalAmount: dec(dto.pricing.totalAmount),
      paymentStatus: dto.payment.paymentStatus,
      paymentMethod: dto.payment.paymentMethod,
      transactionId: dto.payment.transactionId,
      paidAt: dto.payment.paidAt ? new Date(dto.payment.paidAt) : undefined,
      bookingStatus: dto.bookingStatus ?? 'pending',
      notes: dto.notes,
      items: itemsPayload,
    };
    const booking = this.bookingRepo.create(bookingPayload);

    const saved = await this.bookingRepo.save(booking);
    const full = await this.bookingRepo.findOneOrFail({ where: { id: saved.id }, relations: ['items'] });
    return this.toApi(full);
  }

  async update(tenantId: string, bookingId: string, dto: UpdateBookingDto): Promise<BookingApiRow> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId, tenantId },
      relations: ['items'],
    });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);

    if (dto.bookingStatus !== undefined) booking.bookingStatus = dto.bookingStatus;
    if (dto.notes !== undefined) booking.notes = dto.notes;
    if (dto.cancellationReason !== undefined) booking.cancellationReason = dto.cancellationReason;
    if (dto.payment?.paymentStatus !== undefined) booking.paymentStatus = dto.payment.paymentStatus;
    if (dto.payment?.paymentMethod !== undefined) booking.paymentMethod = dto.payment.paymentMethod;
    if (dto.payment?.transactionId !== undefined) booking.transactionId = dto.payment.transactionId;
    if (dto.payment?.paidAt !== undefined) {
      booking.paidAt = dto.payment.paidAt ? new Date(dto.payment.paidAt) : undefined;
    }
    if (dto.itemStatuses?.length) {
      const byId = new Map(booking.items.map((i) => [i.id, i]));
      for (const row of dto.itemStatuses) {
        const item = byId.get(row.itemId);
        if (!item) throw new BadRequestException(`Item ${row.itemId} not in this booking`);
        item.itemStatus = row.status;
      }
    }
    await this.bookingRepo.save(booking);
    return this.toApi(booking);
  }

  async editBookingFacilitySlots(
    _tenantId: string,
    bookingId: string,
    blocked: boolean,
  ): Promise<{ ok: true; bookingId: string; blocked: boolean }> {
    return { ok: true, bookingId, blocked };
  }

  async getAvailabilityByTime(
    tenantId: string,
    params: { date: string; startTime: string; endTime: string; sportType?: BookingSportType },
  ) {
    const date = formatDateOnly(params.date);
    const allCourts = await this.padelRepo.find({
      where: { tenantId, isActive: true, courtStatus: 'active' },
      select: ['id', 'name', 'pricePerSlot', 'slotDurationMinutes'],
    });
    const busy = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.items', 'i')
      .where('b.tenantId = :tenantId', { tenantId })
      .andWhere('b.bookingDate = :date', { date })
      .andWhere("b.bookingStatus = 'confirmed'")
      .andWhere("i.itemStatus = 'confirmed'")
      .andWhere('i.startTime < :end', { end: params.endTime })
      .andWhere('i.endTime > :start', { start: params.startTime })
      .select(['i.courtId AS courtId', 'i.startTime AS startTime', 'i.endTime AS endTime', 'b.id AS bookingId', 'i.id AS id', 'i.itemStatus AS itemStatus'])
      .getRawMany<{ courtId: string; startTime: string; endTime: string; bookingId: string; id: string; itemStatus: BookingItemStatus }>();

    const busyIds = new Set(busy.map((x) => x.courtId));
    return {
      date,
      startTime: params.startTime,
      endTime: params.endTime,
      sportType: 'padel' as const,
      availableCourts: allCourts
        .filter((c) => !busyIds.has(c.id))
        .map((c) => ({
          kind: 'padel_court' as const,
          id: c.id,
          name: c.name,
          pricePerSlot: c.pricePerSlot ? Number(c.pricePerSlot) : null,
          slotDurationMinutes: c.slotDurationMinutes ?? null,
        })),
      bookedSlots: busy.map((x) => ({
        kind: 'padel_court' as const,
        courtId: x.courtId,
        startTime: x.startTime,
        endTime: x.endTime,
        bookingId: x.bookingId,
        itemId: x.id,
        status: x.itemStatus,
      })),
    };
  }

  async getCourtSlots(
    tenantId: string,
    params: { kind: CourtKind; courtId: string; date: string; startTime?: string; endTime?: string },
  ) {
    if (params.kind !== 'padel_court') throw new BadRequestException('Only padel_court is supported');
    await this.assertPadelCourtExists(tenantId, params.courtId);
    const date = formatDateOnly(params.date);
    const start = toMinutes(params.startTime ?? '00:00');
    const end = toMinutes(params.endTime ?? '24:00');
    const rows = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.items', 'i')
      .where('b.tenantId = :tenantId', { tenantId })
      .andWhere('b.bookingDate = :date', { date })
      .andWhere("b.bookingStatus = 'confirmed'")
      .andWhere("i.itemStatus = 'confirmed'")
      .andWhere('i.courtKind = :kind', { kind: 'padel_court' })
      .andWhere('i.courtId = :courtId', { courtId: params.courtId })
      .select(['b.id AS bookingId', 'i.id AS id', 'i.startTime AS startTime', 'i.endTime AS endTime', 'i.itemStatus AS itemStatus'])
      .getRawMany<{ bookingId: string; id: string; startTime: string; endTime: string; itemStatus: BookingItemStatus }>();

    const slots: Array<any> = [];
    for (let m = start; m < end; m += COURT_SLOT_GRID_STEP_MINUTES) {
      const s = minutesToTimeString(m);
      const e = minutesToTimeString(m + COURT_SLOT_GRID_STEP_MINUTES);
      const hit = rows.find((r) => toMinutes(r.startTime) < toMinutes(e) && toMinutes(r.endTime) > toMinutes(s));
      if (hit) {
        slots.push({ startTime: s, endTime: e, availability: 'booked', bookingId: hit.bookingId, itemId: hit.id, status: hit.itemStatus });
      } else {
        slots.push({ startTime: s, endTime: e, availability: 'available' });
      }
    }
    return { date, kind: 'padel_court' as const, courtId: params.courtId, slots };
  }

  async getCourtSlotGrid(
    tenantId: string,
    params: { kind: CourtKind; courtId: string; date: string; startTime?: string; endTime?: string; availableOnly?: boolean },
  ) {
    const data = await this.getCourtSlots(tenantId, params);
    const segments = data.slots.map((s: any) =>
      s.availability === 'booked'
        ? { startTime: s.startTime, endTime: s.endTime, state: 'booked', bookingId: s.bookingId, itemId: s.itemId, status: s.status }
        : { startTime: s.startTime, endTime: s.endTime, state: 'free' },
    );
    return {
      date: data.date,
      kind: data.kind,
      courtId: data.courtId,
      segmentMinutes: COURT_SLOT_GRID_STEP_MINUTES,
      gridStartTime: params.startTime ?? '00:00',
      gridEndTime: params.endTime ?? '24:00',
      availableOnly: params.availableOnly || undefined,
      segments: params.availableOnly ? segments.filter((s: any) => s.state === 'free') : segments,
    };
  }

  async generateDayFacilitySlots(
    tenantId: string,
    params: { kind: CourtKind; courtId: string; date: string },
  ): Promise<{ ok: true; upserted: number }> {
    if (params.kind !== 'padel_court') throw new BadRequestException('Only padel_court is supported');
    await this.assertPadelCourtExists(tenantId, params.courtId);
    const date = formatDateOnly(params.date);
    const values: Partial<CourtFacilitySlot>[] = [];
    for (let m = 0; m < 24 * 60; m += COURT_SLOT_GRID_STEP_MINUTES) {
      values.push({
        tenantId,
        courtKind: 'padel_court',
        courtId: params.courtId,
        slotDate: date,
        startTime: minutesToTimeString(m),
        endTime: minutesToTimeString(m + COURT_SLOT_GRID_STEP_MINUTES),
        status: 'available',
      });
    }
    await this.facilitySlotRepo
      .createQueryBuilder()
      .insert()
      .into(CourtFacilitySlot)
      .values(values as CourtFacilitySlot[])
      .orIgnore()
      .execute();
    return { ok: true, upserted: values.length };
  }

  async patchFacilitySlot(
    tenantId: string,
    params: { kind: CourtKind; courtId: string; date: string; startTime: string; status: 'available' | 'blocked' },
  ) {
    if (params.kind !== 'padel_court') throw new BadRequestException('Only padel_court is supported');
    await this.assertPadelCourtExists(tenantId, params.courtId);
    await this.facilitySlotRepo.upsert(
      {
        tenantId,
        courtKind: 'padel_court',
        courtId: params.courtId,
        slotDate: formatDateOnly(params.date),
        startTime: params.startTime,
        endTime: minutesToTimeString(toMinutes(params.startTime) + COURT_SLOT_GRID_STEP_MINUTES),
        status: params.status,
      },
      { conflictPaths: ['tenantId', 'courtKind', 'courtId', 'slotDate', 'startTime'] },
    );
    return { ok: true };
  }

  async setCourtSlotBlock(
    tenantId: string,
    params: { kind: CourtKind; courtId: string; date: string; startTime: string; blocked: boolean },
  ) {
    if (params.kind !== 'padel_court') throw new BadRequestException('Only padel_court is supported');
    await this.assertPadelCourtExists(tenantId, params.courtId);
    const where = {
      tenantId,
      courtKind: 'padel_court' as CourtKind,
      courtId: params.courtId,
      blockDate: formatDateOnly(params.date),
      startTime: params.startTime,
    };
    if (params.blocked) {
      const existing = await this.slotBlockRepo.findOne({ where });
      if (!existing) await this.slotBlockRepo.save(this.slotBlockRepo.create(where));
    } else {
      await this.slotBlockRepo.delete(where);
    }
    return { ok: true };
  }

  async getLocationFacilitiesAvailableSlots(params: {
    locationId: string;
    date: string;
    startTime?: string;
    endTime?: string;
    courtType?: string;
  }) {
    const date = formatDateOnly(params.date);
    const courts = await this.padelRepo.find({
      where: { businessLocationId: params.locationId, isActive: true, courtStatus: In(['active', 'draft']) as any },
      select: ['id', 'name', 'tenantId'],
    });
    const facilities: Array<{ kind: CourtKind; courtId: string; name: string; slots: Array<{ startTime: string; endTime: string }> }> = [];
    for (const court of courts) {
      const grid = await this.getCourtSlotGrid(court.tenantId, {
        kind: 'padel_court',
        courtId: court.id,
        date,
        startTime: params.startTime,
        endTime: params.endTime,
        availableOnly: true,
      });
      facilities.push({
        kind: 'padel_court',
        courtId: court.id,
        name: court.name,
        slots: grid.segments.map((s: any) => ({ startTime: s.startTime, endTime: s.endTime })),
      });
    }
    const unionMap = new Map<string, { startTime: string; endTime: string }>();
    for (const f of facilities) {
      for (const s of f.slots) unionMap.set(`${s.startTime}\t${s.endTime}`, s);
    }
    return {
      date,
      locationId: params.locationId,
      courtType: 'padel_court' as const,
      facilities,
      unionSlots: [...unionMap.values()].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    };
  }

  async getLocationFacilitiesAvailableForSlot(params: {
    locationId: string;
    date: string;
    startTime: string;
    endTime?: string;
  }) {
    const date = formatDateOnly(params.date);
    const end = params.endTime ?? minutesToTimeString(toMinutes(params.startTime) + COURT_SLOT_GRID_STEP_MINUTES);
    const courts = await this.padelRepo.find({
      where: { businessLocationId: params.locationId, isActive: true, courtStatus: In(['active', 'draft']) as any },
      select: ['id', 'name', 'tenantId'],
    });
    const facilities: Array<{ kind: CourtKind; courtId: string; name: string }> = [];
    for (const c of courts) {
      const slots = await this.getCourtSlots(c.tenantId, {
        kind: 'padel_court',
        courtId: c.id,
        date,
        startTime: params.startTime,
        endTime: end,
      });
      if (slots.slots.some((s: any) => s.startTime === params.startTime && s.endTime === end && s.availability === 'available')) {
        facilities.push({ kind: 'padel_court', courtId: c.id, name: c.name });
      }
    }
    return { date, locationId: params.locationId, startTime: params.startTime, endTime: end, facilities };
  }

  private normalizePadelFacilityToCourtKind(raw: string): CourtKind {
    const s = raw.trim().toLowerCase().replace(/-/g, '_');
    if (s === 'padel' || s === 'padel_court') return 'padel_court';
    throw new BadRequestException('facilitySelected must be padel_court');
  }

  async placePadelBooking(dto: PlacePadelBookingDto): Promise<{ message: string; bookingId: string; placedAt: string }> {
    const loc = await this.locationRepo.findOne({ where: { id: dto.venueId } });
    if (!loc) throw new NotFoundException(`Venue ${dto.venueId} not found`);
    const business = await this.businessRepo.findOne({ where: { id: loc.businessId } });
    if (!business) throw new BadRequestException('Venue has no business record');
    const tenantId = business.tenantId;
    const courtKind = this.normalizePadelFacilityToCourtKind(dto.facilitySelected);
    const court = await this.assertPadelCourtExists(tenantId, dto.fieldSelected);
    if ((court.businessLocationId ?? '') !== dto.venueId) {
      throw new BadRequestException('Selected court does not belong to this venue');
    }

    const booking = await this.create(tenantId, {
      userId: dto.userId,
      sportType: 'padel',
      bookingDate: dto.date.slice(0, 10),
      items: [
        {
          courtKind,
          courtId: dto.fieldSelected,
          startTime: dto.startTime,
          endTime: dto.endTime,
          price: 0,
          currency: loc.currency ?? 'PKR',
          status: 'reserved',
        },
      ],
      pricing: { subTotal: 0, discount: 0, tax: 0, totalAmount: 0 },
      payment: { paymentStatus: 'pending', paymentMethod: 'cash' },
      bookingStatus: 'pending',
    });
    return { message: 'Booking placed successfully', bookingId: booking.bookingId, placedAt: booking.createdAt };
  }
}
