import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PadelCourt } from '../arena/padel-court/entities/padel-court.entity';
import { CricketCourt } from '../arena/cricket-court/entities/cricket-court.entity';
import { FutsalCourt } from '../arena/futsal-court/entities/futsal-court.entity';
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
import type { PlaceCricketBookingDto } from './dto/place-cricket-booking.dto';
import type { PlaceFutsalBookingDto } from './dto/place-futsal-booking.dto';
import type { PlacePadelBookingDto } from './dto/place-padel-booking.dto';
import { CourtFacilitySlot } from './entities/court-facility-slot.entity';
import { CourtSlotBookingBlock } from './entities/court-slot-booking-block.entity';
import { Booking } from './entities/booking.entity';
import { getWorkingDayWindow } from './working-hours.util';

function dec(n: number): string {
  return Number(n).toFixed(2);
}

function numFromDec(v: string): number {
  return Number.parseFloat(v);
}

function optNumFromDec(v: string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
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

function minutesToTimeString(m: number): string {
  if (m >= 24 * 60) return '24:00';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** First slot start (on {@link COURT_SLOT_GRID_STEP_MINUTES} grid) at or after this time. */
function snapUpToSlotBoundary(time: string): string {
  const step = COURT_SLOT_GRID_STEP_MINUTES;
  const m = toMinutes(time);
  const up = Math.ceil(m / step) * step;
  if (up >= 24 * 60) return '24:00';
  return minutesToTimeString(up);
}

/**
 * Exclusive grid end: latest time on a slot boundary ≤ `close` (aligned to {@link COURT_SLOT_GRID_STEP_MINUTES}).
 */
function snapDownExclusiveEnd(close: string): string {
  if (close === '24:00') return '24:00';
  const step = COURT_SLOT_GRID_STEP_MINUTES;
  const m = toMinutes(close);
  const down = Math.floor(m / step) * step;
  return minutesToTimeString(down);
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
  /** Base price for one booking slot when configured; null if not set on this facility. */
  pricePerSlot: number | null;
  /** Slot length in minutes from facility settings, when set. */
  slotDurationMinutes: number | null;
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
  slots: Array<
    | {
        startTime: string;
        endTime: string;
        availability: 'available';
      }
    | {
        startTime: string;
        endTime: string;
        availability: 'blocked';
      }
    | {
        startTime: string;
        endTime: string;
        availability: 'booked';
        bookingId: string;
        itemId: string;
        status: BookingItemStatus;
      }
  >;
};

export type CourtSlotGridSegment =
  | {
      startTime: string;
      endTime: string;
      state: 'free';
    }
  | {
      startTime: string;
      endTime: string;
      state: 'booked';
      bookingId: string;
      itemId: string;
      status: BookingItemStatus;
    }
  | {
      startTime: string;
      endTime: string;
      state: 'blocked';
    }
  | {
      startTime: string;
      endTime: string;
      state: 'closed';
    };

export type CourtSlotGridApiRow = {
  date: string;
  kind: CourtKind;
  courtId: string;
  segmentMinutes: typeof COURT_SLOT_GRID_STEP_MINUTES;
  /** Effective grid window (aligned to hourly slot boundaries). */
  gridStartTime: string;
  gridEndTime: string;
  /** Set when optional `useWorkingHours=true` overlay was applied. */
  workingHoursApplied?: boolean;
  /** Set when the optional overlay marks venue closed for `date`. */
  locationClosed?: boolean;
  /** When true, `segments` only lists free slots (booked intervals omitted). */
  availableOnly?: boolean;
  segments: CourtSlotGridSegment[];
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
    @InjectRepository(FutsalCourt)
    private readonly futsalCourtRepo: Repository<FutsalCourt>,
    @InjectRepository(CricketCourt)
    private readonly cricketCourtRepo: Repository<CricketCourt>,
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
  ) {}

  /** Map key `${courtKind}:${courtId}` → business location id (first item of each booking). */
  private async resolveCourtToBusinessLocationMap(
    tenantId: string,
    bookings: Booking[],
  ): Promise<Map<string, string>> {
    const key = (kind: CourtKind, courtId: string) => `${kind}:${courtId}`;
    const out = new Map<string, string>();
    const futsalIds = new Set<string>();
    const cricketIds = new Set<string>();
    const padelIds = new Set<string>();
    for (const b of bookings) {
      const it = b.items?.[0];
      if (!it?.courtId || !it.courtKind) continue;
      if (it.courtKind === 'futsal_court') futsalIds.add(it.courtId);
      else if (it.courtKind === 'cricket_court') cricketIds.add(it.courtId);
      else if (it.courtKind === 'padel_court') padelIds.add(it.courtId);
    }
    if (futsalIds.size > 0) {
      const rows = await this.futsalCourtRepo.find({
        where: { tenantId, id: In([...futsalIds]) },
        select: ['id', 'businessLocationId'],
      });
      for (const r of rows) {
        const bl = r.businessLocationId?.trim();
        if (bl) out.set(key('futsal_court', r.id), bl);
      }
    }
    if (cricketIds.size > 0) {
      const rows = await this.cricketCourtRepo.find({
        where: { tenantId, id: In([...cricketIds]) },
        select: ['id', 'businessLocationId'],
      });
      for (const r of rows) {
        const bl = r.businessLocationId?.trim();
        if (bl) out.set(key('cricket_court', r.id), bl);
      }
    }
    if (padelIds.size > 0) {
      const rows = await this.padelRepo.find({
        where: { tenantId, id: In([...padelIds]) },
        select: ['id', 'businessLocationId'],
      });
      for (const r of rows) {
        const bl = r.businessLocationId?.trim();
        if (bl) out.set(key('padel_court', r.id), bl);
      }
    }
    return out;
  }

  private toApi(booking: Booking, courtToLocation?: Map<string, string>): BookingApiRow {
    const first = booking.items?.[0];
    let arenaId = booking.tenantId;
    if (first && courtToLocation) {
      const locId = courtToLocation.get(`${first.courtKind}:${first.courtId}`);
      if (locId) arenaId = locId;
    }
    return {
      bookingId: booking.id,
      arenaId,
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
    const courtToLocation = await this.resolveCourtToBusinessLocationMap(tenantId, rows);
    return rows.map((b) => this.toApi(b, courtToLocation));
  }

  /** All bookings for a user across tenants (e.g. GET /PreviousBookings/:userId). */
  async listByUserForProfile(userId: string): Promise<BookingApiRow[]> {
    const rows = await this.bookingRepo.find({
      where: { userId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
    const byTenant = new Map<string, Booking[]>();
    for (const b of rows) {
      const list = byTenant.get(b.tenantId) ?? [];
      list.push(b);
      byTenant.set(b.tenantId, list);
    }
    const out: BookingApiRow[] = [];
    for (const [tenantId, list] of byTenant) {
      const courtToLocation = await this.resolveCourtToBusinessLocationMap(tenantId, list);
      for (const b of list) {
        out.push(this.toApi(b, courtToLocation));
      }
    }
    out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return out;
  }

  async getOne(tenantId: string, bookingId: string): Promise<BookingApiRow> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId, tenantId },
      relations: ['items'],
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }
    const courtToLocation = await this.resolveCourtToBusinessLocationMap(tenantId, [booking]);
    return this.toApi(booking, courtToLocation);
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
      this.assertFutureSlotBooking(dto.bookingDate, item);
      await this.assertCourtValidForSport(tenantId, dto.sportType, item);
      await this.assertItemSegmentsNotBlocked(tenantId, dto.bookingDate, item);
      await this.assertNoBookingOverlapForItem(tenantId, dto.bookingDate, item);
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
    const courtToLocation = await this.resolveCourtToBusinessLocationMap(tenantId, [full]);
    return this.toApi(full, courtToLocation);
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
    const allOverlap = items.filter((it) =>
      this.timesOverlap(
        params.startTime,
        params.endTime,
        it.startTime,
        it.endTime,
      ),
    );
    const blockedExpanded = new Set<string>();
    for (const it of allOverlap) {
      const keys = await this.resolveBookingLinkedCourtKeys(
        tenantId,
        it.courtKind,
        it.courtId,
      );
      for (const k of keys) {
        blockedExpanded.add(`${k.kind}:${k.courtId}`);
      }
    }
    const overlapping = allOverlap.filter((it) =>
      courtByKey.has(`${it.courtKind}:${it.courtId}`),
    );
    return {
      date: dateOnly,
      startTime: params.startTime,
      endTime: params.endTime,
      sportType: params.sportType,
      availableCourts: courts.filter(
        (c) => !blockedExpanded.has(`${c.kind}:${c.id}`),
      ),
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
    params: {
      kind: CourtKind;
      courtId: string;
      date: string;
      startTime?: string;
      endTime?: string;
    },
  ): Promise<CourtSlotsApiRow> {
    const dateOnly = formatDateOnly(params.date);
    const startT = params.startTime ?? '00:00';
    const endT = params.endTime ?? '24:00';
    const { startMin, endMin } = this.parseSlotGridWindow(startT, endT);
    const rows = await this.listBookedItemsForDate(tenantId, dateOnly);
    const gridKeys = await this.resolveBookingLinkedCourtKeys(
      tenantId,
      params.kind,
      params.courtId,
    );
    const gridKeySet = new Set(
      gridKeys.map((k) => `${k.kind}:${k.courtId}`),
    );
    const bookings = rows
      .filter((it) => gridKeySet.has(`${it.courtKind}:${it.courtId}`))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const blockedStarts = await this.loadBlockedStartsSetMerged(
      tenantId,
      params.kind,
      params.courtId,
      dateOnly,
    );

    const slots: CourtSlotsApiRow['slots'] = [];
    const step = COURT_SLOT_GRID_STEP_MINUTES;
    for (let segStart = startMin; segStart < endMin; segStart += step) {
      const segEnd = segStart + step;
      const segStartLabel = minutesToTimeString(segStart);
      const segEndLabel = minutesToTimeString(segEnd);
      const overlap = bookings.find((b) =>
        this.segmentOverlapsMinutes(
          segStart,
          segEnd,
          b.startTime,
          b.endTime,
        ),
      );
      if (overlap) {
        slots.push({
          startTime: segStartLabel,
          endTime: segEndLabel,
          availability: 'booked',
          bookingId: overlap.bookingId,
          itemId: overlap.id,
          status: overlap.itemStatus,
        });
      } else if (blockedStarts.has(segStartLabel)) {
        slots.push({
          startTime: segStartLabel,
          endTime: segEndLabel,
          availability: 'blocked',
        });
      } else {
        slots.push({
          startTime: segStartLabel,
          endTime: segEndLabel,
          availability: 'available',
        });
      }
    }
    return {
      date: dateOnly,
      kind: params.kind,
      courtId: params.courtId,
      slots,
    };
  }

  /**
   * Creates default hourly slot rows for the calendar date (idempotent).
   * Applies to this court and any linked futsal/cricket twin.
   */
  async generateDayFacilitySlots(
    tenantId: string,
    params: { kind: CourtKind; courtId: string; date: string },
  ): Promise<{ ok: true; upserted: number }> {
    const dateOnly = formatDateOnly(params.date);
    await this.assertCourtExistsForTenant(tenantId, params.kind, params.courtId);
    const keys = await this.resolveBookingLinkedCourtKeys(
      tenantId,
      params.kind,
      params.courtId,
    );
    const rows: Partial<CourtFacilitySlot>[] = [];
    const step = COURT_SLOT_GRID_STEP_MINUTES;
    for (const k of keys) {
      for (let segStart = 0; segStart < 24 * 60; segStart += step) {
        const segEnd = segStart + step;
        rows.push({
          tenantId,
          courtKind: k.kind,
          courtId: k.courtId,
          slotDate: dateOnly,
          startTime: minutesToTimeString(segStart),
          endTime: minutesToTimeString(segEnd),
          status: 'available',
        });
      }
    }
    if (rows.length === 0) {
      return { ok: true, upserted: 0 };
    }
    await this.facilitySlotRepo
      .createQueryBuilder()
      .insert()
      .into(CourtFacilitySlot)
      .values(rows as CourtFacilitySlot[])
      .orIgnore()
      .execute();
    return { ok: true, upserted: rows.length };
  }

  async patchFacilitySlot(
    tenantId: string,
    params: {
      kind: CourtKind;
      courtId: string;
      date: string;
      startTime: string;
      status: 'available' | 'blocked';
    },
  ): Promise<{ ok: true }> {
    const dateOnly = formatDateOnly(params.date);
    this.assertSlotBlockStartTime(params.startTime);
    await this.assertCourtExistsForTenant(tenantId, params.kind, params.courtId);

    const gridKeys = await this.resolveBookingLinkedCourtKeys(
      tenantId,
      params.kind,
      params.courtId,
    );
    const gridKeySet = new Set(
      gridKeys.map((k) => `${k.kind}:${k.courtId}`),
    );
    const bookings = await this.listBookedItemsForDate(tenantId, dateOnly);
    const segStart = toMinutes(params.startTime);
    const segEnd = segStart + COURT_SLOT_GRID_STEP_MINUTES;
    const overlap = bookings.find(
      (b) =>
        gridKeySet.has(`${b.courtKind}:${b.courtId}`) &&
        this.segmentOverlapsMinutes(segStart, segEnd, b.startTime, b.endTime),
    );
    if (overlap) {
      throw new BadRequestException(
        'This segment has an active booking; change the booking instead of the slot row.',
      );
    }

    const endLabel = minutesToTimeString(segEnd);
    for (const k of gridKeys) {
      await this.facilitySlotRepo.upsert(
        {
          tenantId,
          courtKind: k.kind,
          courtId: k.courtId,
          slotDate: dateOnly,
          startTime: params.startTime,
          endTime: endLabel,
          status: params.status,
        },
        {
          conflictPaths: [
            'tenantId',
            'courtKind',
            'courtId',
            'slotDate',
            'startTime',
          ],
        },
      );
    }
    return { ok: true };
  }

  /**
   * Full-day (or window) timeline in fixed hourly segments for one facility/court.
   * `useWorkingHours` is an optional display overlay for grid bounds; booking enforcement
   * is still driven by existing bookings + slot blocks. Use `availableOnly` to return only
   * bookable (free) segments for pickers.
   */
  async getCourtSlotGrid(
    tenantId: string,
    params: {
      kind: CourtKind;
      courtId: string;
      date: string;
      startTime?: string;
      endTime?: string;
      useWorkingHours?: boolean;
      availableOnly?: boolean;
    },
  ): Promise<CourtSlotGridApiRow> {
    const dateOnly = formatDateOnly(params.date);
    let workingHoursApplied = false;
    let locationClosed = false;
    /** Entire grid window is non-bookable (marked closed in weekly hours). */
    let dayClosedByWorkingHours = false;

    const explicitWindow =
      params.startTime !== undefined || params.endTime !== undefined;

    let startT = params.startTime ?? '00:00';
    let endT = params.endTime ?? '24:00';

    if (!explicitWindow && params.useWorkingHours) {
      const locId = await this.getBusinessLocationIdForCourt(
        tenantId,
        params.kind,
        params.courtId,
      );
      if (locId) {
        const loc = await this.locationRepo.findOne({
          where: { id: locId },
          select: ['id', 'workingHours'],
        });
        if (loc?.workingHours && typeof loc.workingHours === 'object') {
          const win = getWorkingDayWindow(
            loc.workingHours as Record<string, unknown>,
            dateOnly,
          );
          workingHoursApplied = true;
          if (win.closed) {
            locationClosed = true;
            startT = win.open;
            endT = win.close === '24:00' ? '24:00' : win.close;
            try {
              this.parseSlotGridWindow(startT, endT);
              dayClosedByWorkingHours = true;
            } catch {
              return {
                date: dateOnly,
                kind: params.kind,
                courtId: params.courtId,
                segmentMinutes: COURT_SLOT_GRID_STEP_MINUTES,
                gridStartTime: win.open,
                gridEndTime: win.close,
                workingHoursApplied,
                locationClosed,
                availableOnly: params.availableOnly,
                segments: [],
              };
            }
          } else {
            startT = snapUpToSlotBoundary(win.open);
            endT =
              win.close === '24:00' ? '24:00' : snapDownExclusiveEnd(win.close);
            const openM = toMinutes(startT);
            const endM = endT === '24:00' ? 24 * 60 : toMinutes(endT);
            if (openM >= endM) {
              return {
                date: dateOnly,
                kind: params.kind,
                courtId: params.courtId,
                segmentMinutes: COURT_SLOT_GRID_STEP_MINUTES,
                gridStartTime: startT,
                gridEndTime: endT,
                workingHoursApplied,
                availableOnly: params.availableOnly,
                segments: [],
              };
            }
          }
        }
      }
    }

    const { startMin, endMin } = this.parseSlotGridWindow(startT, endT);

    const rows = await this.listBookedItemsForDate(tenantId, dateOnly);
    const gridKeys = await this.resolveBookingLinkedCourtKeys(
      tenantId,
      params.kind,
      params.courtId,
    );
    const gridKeySet = new Set(
      gridKeys.map((k) => `${k.kind}:${k.courtId}`),
    );
    const bookings = rows
      .filter((it) => gridKeySet.has(`${it.courtKind}:${it.courtId}`))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const blockedStarts = await this.loadBlockedStartsSetMerged(
      tenantId,
      params.kind,
      params.courtId,
      dateOnly,
    );

    const segments: CourtSlotGridSegment[] = [];
    const step = COURT_SLOT_GRID_STEP_MINUTES;
    for (let segStart = startMin; segStart < endMin; segStart += step) {
      const segEnd = segStart + step;
      const segStartLabel = minutesToTimeString(segStart);
      if (dayClosedByWorkingHours) {
        segments.push({
          startTime: segStartLabel,
          endTime: minutesToTimeString(segEnd),
          state: 'closed',
        });
        continue;
      }
      const overlap = bookings.find((b) =>
        this.segmentOverlapsMinutes(
          segStart,
          segEnd,
          b.startTime,
          b.endTime,
        ),
      );
      if (overlap) {
        segments.push({
          startTime: segStartLabel,
          endTime: minutesToTimeString(segEnd),
          state: 'booked',
          bookingId: overlap.bookingId,
          itemId: overlap.id,
          status: overlap.itemStatus,
        });
      } else if (blockedStarts.has(segStartLabel)) {
        segments.push({
          startTime: segStartLabel,
          endTime: minutesToTimeString(segEnd),
          state: 'blocked',
        });
      } else {
        segments.push({
          startTime: segStartLabel,
          endTime: minutesToTimeString(segEnd),
          state: 'free',
        });
      }
    }

    const filtered =
      params.availableOnly === true
        ? segments.filter((s) => s.state === 'free')
        : segments;

    return {
      date: dateOnly,
      kind: params.kind,
      courtId: params.courtId,
      segmentMinutes: COURT_SLOT_GRID_STEP_MINUTES,
      gridStartTime: minutesToTimeString(startMin),
      gridEndTime: minutesToTimeString(endMin),
      workingHoursApplied: workingHoursApplied || undefined,
      locationClosed: locationClosed || undefined,
      availableOnly: params.availableOnly || undefined,
      segments: filtered,
    };
  }

  async setCourtSlotBlock(
    tenantId: string,
    params: {
      kind: CourtKind;
      courtId: string;
      date: string;
      startTime: string;
      blocked: boolean;
    },
  ): Promise<{ ok: true }> {
    const dateOnly = formatDateOnly(params.date);
    this.assertSlotBlockStartTime(params.startTime);
    await this.assertCourtExistsForTenant(tenantId, params.kind, params.courtId);

    const blockKeys = await this.resolveBookingLinkedCourtKeys(
      tenantId,
      params.kind,
      params.courtId,
    );
    for (const k of blockKeys) {
      if (params.blocked) {
        const existing = await this.slotBlockRepo.findOne({
          where: {
            tenantId,
            courtKind: k.kind,
            courtId: k.courtId,
            blockDate: dateOnly,
            startTime: params.startTime,
          },
        });
        if (!existing) {
          await this.slotBlockRepo.save(
            this.slotBlockRepo.create({
              tenantId,
              courtKind: k.kind,
              courtId: k.courtId,
              blockDate: dateOnly,
              startTime: params.startTime,
            }),
          );
        }
      } else {
        await this.slotBlockRepo.delete({
          tenantId,
          courtKind: k.kind,
          courtId: k.courtId,
          blockDate: dateOnly,
          startTime: params.startTime,
        });
      }
    }
    return { ok: true };
  }

  private async getBusinessLocationIdForCourt(
    tenantId: string,
    kind: CourtKind,
    courtId: string,
  ): Promise<string | null> {
    switch (kind) {
      case 'futsal_court': {
        const row = await this.futsalCourtRepo.findOne({
          where: { id: courtId, tenantId },
          select: ['businessLocationId'],
        });
        return row?.businessLocationId ?? null;
      }
      case 'cricket_court': {
        const row = await this.cricketCourtRepo.findOne({
          where: { id: courtId, tenantId },
          select: ['businessLocationId'],
        });
        return row?.businessLocationId ?? null;
      }
      case 'padel_court': {
        const row = await this.padelRepo.findOne({
          where: { id: courtId, tenantId },
          select: ['businessLocationId'],
        });
        return row?.businessLocationId ?? null;
      }
      default:
        return null;
    }
  }

  private parseSlotGridWindow(
    startTime: string,
    endTime: string,
  ): { startMin: number; endMin: number } {
    const step = COURT_SLOT_GRID_STEP_MINUTES;
    const startMin = toMinutes(startTime);
    const endMin = endTime === '24:00' ? 24 * 60 : toMinutes(endTime);
    if (endMin <= startMin) {
      throw new BadRequestException('endTime must be after startTime');
    }
    if (startMin % step !== 0 || endMin % step !== 0) {
      throw new BadRequestException(
        `startTime and endTime must be on ${step}-minute (hourly) boundaries`,
      );
    }
    if ((endMin - startMin) % step !== 0) {
      throw new BadRequestException(
        `Grid window length must be a multiple of ${step} minutes`,
      );
    }
    return { startMin, endMin };
  }

  private segmentOverlapsMinutes(
    segStartMin: number,
    segEndMin: number,
    bookingStart: string,
    bookingEnd: string,
  ): boolean {
    const bStart = toMinutes(bookingStart);
    const bEnd = toMinutes(bookingEnd);
    return segStartMin < bEnd && bStart < segEndMin;
  }

  private assertSlotBlockStartTime(time: string): void {
    const step = COURT_SLOT_GRID_STEP_MINUTES;
    const m = toMinutes(time);
    if (m < 0 || m >= 24 * 60 || m % step !== 0) {
      throw new BadRequestException(
        `startTime must be an hourly slot start between 00:00 and 23:00 (${step}-minute grid)`,
      );
    }
  }

  private async loadBlockedStartsSet(
    tenantId: string,
    kind: CourtKind,
    courtId: string,
    dateOnly: string,
  ): Promise<Set<string>> {
    const rows = await this.slotBlockRepo.find({
      where: { tenantId, courtKind: kind, courtId, blockDate: dateOnly },
      select: ['startTime'],
    });
    return new Set(rows.map((r) => r.startTime));
  }

  private async loadFacilitySlotBlockedStartsSet(
    tenantId: string,
    kind: CourtKind,
    courtId: string,
    dateOnly: string,
  ): Promise<Set<string>> {
    const rows = await this.facilitySlotRepo.find({
      where: {
        tenantId,
        courtKind: kind,
        courtId,
        slotDate: dateOnly,
        status: 'blocked',
      },
      select: ['startTime'],
    });
    return new Set(rows.map((r) => r.startTime));
  }

  /** Slot blocks for this court and any linked futsal/cricket twin. */
  private async loadBlockedStartsSetMerged(
    tenantId: string,
    kind: CourtKind,
    courtId: string,
    dateOnly: string,
  ): Promise<Set<string>> {
    const keys = await this.resolveBookingLinkedCourtKeys(
      tenantId,
      kind,
      courtId,
    );
    const merged = new Set<string>();
    for (const k of keys) {
      const part = await this.loadBlockedStartsSet(
        tenantId,
        k.kind,
        k.courtId,
        dateOnly,
      );
      for (const t of part) merged.add(t);
      const facilityBlocked = await this.loadFacilitySlotBlockedStartsSet(
        tenantId,
        k.kind,
        k.courtId,
        dateOnly,
      );
      for (const t of facilityBlocked) merged.add(t);
    }
    return merged;
  }

  private async resolveBookingLinkedCourtKeys(
    tenantId: string,
    kind: CourtKind,
    courtId: string,
  ): Promise<Array<{ kind: CourtKind; courtId: string }>> {
    const self = { kind, courtId };
    if (kind === 'padel_court') {
      return [self];
    }
    if (kind === 'futsal_court') {
      const row = await this.futsalCourtRepo.findOne({
        where: { id: courtId, tenantId },
        select: ['linkedTwinCourtKind', 'linkedTwinCourtId'],
      });
      if (
        row?.linkedTwinCourtId &&
        row.linkedTwinCourtKind === 'cricket_court'
      ) {
        return [self, { kind: 'cricket_court', courtId: row.linkedTwinCourtId }];
      }
      return [self];
    }
    if (kind === 'cricket_court') {
      const row = await this.cricketCourtRepo.findOne({
        where: { id: courtId, tenantId },
        select: ['linkedTwinCourtKind', 'linkedTwinCourtId'],
      });
      if (
        row?.linkedTwinCourtId &&
        row.linkedTwinCourtKind === 'futsal_court'
      ) {
        return [self, { kind: 'futsal_court', courtId: row.linkedTwinCourtId }];
      }
      return [self];
    }
    return [self];
  }

  private async assertNoBookingOverlapForItem(
    tenantId: string,
    bookingDate: string,
    item: CreateBookingItemDto,
  ): Promise<void> {
    const keys = await this.resolveBookingLinkedCourtKeys(
      tenantId,
      item.courtKind,
      item.courtId,
    );
    const keySet = new Set(keys.map((k) => `${k.kind}:${k.courtId}`));
    const dateOnly = formatDateOnly(bookingDate);
    const existing = await this.listBookedItemsForDate(tenantId, dateOnly);
    for (const e of existing) {
      if (!keySet.has(`${e.courtKind}:${e.courtId}`)) continue;
      if (
        this.timesOverlap(
          item.startTime,
          item.endTime,
          e.startTime,
          e.endTime,
        )
      ) {
        throw new BadRequestException(
          'That time range is already booked for this pitch (including any linked futsal/cricket twin)',
        );
      }
    }
  }

  private async assertItemSegmentsNotBlocked(
    tenantId: string,
    bookingDate: string,
    item: CreateBookingItemDto,
  ): Promise<void> {
    const dateOnly = formatDateOnly(bookingDate);
    const blocked = await this.loadBlockedStartsSetMerged(
      tenantId,
      item.courtKind,
      item.courtId,
      dateOnly,
    );
    const startM = toMinutes(item.startTime);
    const endM = toMinutes(item.endTime);
    const step = COURT_SLOT_GRID_STEP_MINUTES;
    for (let m = startM; m < endM; m += step) {
      const key = minutesToTimeString(m);
      if (blocked.has(key)) {
        throw new BadRequestException(
          `Booking not allowed: ${key} is blocked for this court`,
        );
      }
    }
  }

  private async assertCourtExistsForTenant(
    tenantId: string,
    courtKind: CourtKind,
    courtId: string,
  ): Promise<void> {
    switch (courtKind) {
      case 'futsal_court': {
        const row = await this.futsalCourtRepo.findOne({
          where: { id: courtId, tenantId },
        });
        if (!row) {
          throw new BadRequestException(
            `Futsal court ${courtId} not found for this tenant`,
          );
        }
        break;
      }
      case 'cricket_court': {
        const row = await this.cricketCourtRepo.findOne({
          where: { id: courtId, tenantId },
        });
        if (!row) {
          throw new BadRequestException(
            `Cricket court ${courtId} not found for this tenant`,
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
    }
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
    if (sport === 'futsal' && courtKind === 'cricket_court') {
      throw new BadRequestException('futsal booking cannot use cricket_court');
    }
    if (sport === 'cricket' && courtKind === 'futsal_court') {
      throw new BadRequestException('cricket booking cannot use futsal_court');
    }
    if (sport === 'cricket' && courtKind === 'padel_court') {
      throw new BadRequestException('cricket booking cannot use a padel court');
    }

    switch (courtKind) {
      case 'futsal_court': {
        const row = await this.futsalCourtRepo.findOne({
          where: { id: courtId, tenantId },
        });
        if (!row) {
          throw new BadRequestException(
            `Futsal court ${courtId} not found for this tenant`,
          );
        }
        if (sport !== 'futsal') {
          throw new BadRequestException(
            `futsal_court ${courtId} only accepts futsal bookings`,
          );
        }
        if (row.courtStatus !== 'active') {
          throw new BadRequestException(
            'This futsal pitch is not active and cannot be booked',
          );
        }
        break;
      }
      case 'cricket_court': {
        const row = await this.cricketCourtRepo.findOne({
          where: { id: courtId, tenantId },
        });
        if (!row) {
          throw new BadRequestException(
            `Cricket court ${courtId} not found for this tenant`,
          );
        }
        if (sport !== 'cricket') {
          throw new BadRequestException(
            `cricket_court ${courtId} only accepts cricket bookings`,
          );
        }
        if (row.courtStatus !== 'active') {
          throw new BadRequestException(
            'This cricket pitch is not active and cannot be booked',
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
        if (row.courtStatus !== 'active' || row.isActive === false) {
          throw new BadRequestException(
            'This padel court is not active and cannot be booked',
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
      const futsalCourts = await this.futsalCourtRepo.find({
        where: { tenantId, courtStatus: 'active' },
        select: ['id', 'name', 'pricePerSlot', 'slotDurationMinutes'],
      });
      out.push(
        ...futsalCourts.map((r) => ({
          kind: 'futsal_court' as const,
          id: r.id,
          name: r.name,
          pricePerSlot: optNumFromDec(r.pricePerSlot),
          slotDurationMinutes: r.slotDurationMinutes ?? null,
        })),
      );
    }
    if (!sport || sport === 'cricket') {
      const cricketCourts = await this.cricketCourtRepo.find({
        where: { tenantId, courtStatus: 'active' },
        select: ['id', 'name', 'pricePerSlot', 'slotDurationMinutes'],
      });
      out.push(
        ...cricketCourts.map((r) => ({
          kind: 'cricket_court' as const,
          id: r.id,
          name: r.name,
          pricePerSlot: optNumFromDec(r.pricePerSlot),
          slotDurationMinutes: r.slotDurationMinutes ?? null,
        })),
      );
    }
    if (!sport || sport === 'padel') {
      const rows = await this.padelRepo.find({
        where: { tenantId, isActive: true, courtStatus: 'active' },
        select: ['id', 'name', 'pricePerSlot', 'slotDurationMinutes'],
      });
      out.push(
        ...rows.map((r) => ({
          kind: 'padel_court' as const,
          id: r.id,
          name: r.name,
          pricePerSlot: optNumFromDec(r.pricePerSlot),
          slotDurationMinutes: r.slotDurationMinutes ?? null,
        })),
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
    const startAMins = toMinutes(startA);
    const endAMins = toMinutes(endA);
    const startBMins = toMinutes(startB);
    const endBMins = toMinutes(endB);
    return startAMins < endBMins && startBMins < endAMins;
  }

  private assertFutureSlotBooking(
    bookingDate: string,
    item: CreateBookingItemDto,
  ): void {
    const step = COURT_SLOT_GRID_STEP_MINUTES;
    const startMins = toMinutes(item.startTime);
    const endMins = toMinutes(item.endTime);
    if (endMins <= startMins) {
      throw new BadRequestException('endTime must be after startTime');
    }

    const duration = endMins - startMins;
    if (duration < step) {
      throw new BadRequestException(
        `Booking duration must be at least ${step} minutes`,
      );
    }
    if (startMins % step !== 0 || endMins % step !== 0 || duration % step !== 0) {
      throw new BadRequestException(
        `startTime/endTime must be on ${step}-minute (hourly) intervals`,
      );
    }

    const startAt = new Date(`${bookingDate}T${item.startTime}:00`);
    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('Invalid bookingDate/startTime');
    }
    const minStart = new Date(Date.now() + step * 60 * 1000);
    if (startAt.getTime() < minStart.getTime()) {
      throw new BadRequestException(
        `Bookings must be scheduled at least ${step} minutes in the future`,
      );
    }
  }

  /**
   * End-user shortcut: resolves tenant from venueId and creates a futsal booking.
   * `createdAt` is stored on the booking row by TypeORM (see response `placedAt`).
   */
  async placeFutsalBooking(dto: PlaceFutsalBookingDto): Promise<{
    message: string;
    bookingId: string;
    placedAt: string;
  }> {
    const loc = await this.locationRepo.findOne({ where: { id: dto.venueId } });
    if (!loc) {
      throw new NotFoundException(`Venue ${dto.venueId} not found`);
    }
    const business = await this.businessRepo.findOne({
      where: { id: loc.businessId },
    });
    if (!business) {
      throw new BadRequestException('Venue has no business record');
    }
    const tenantId = business.tenantId;
    const courtKind = this.normalizeFutsalFacilityToCourtKind(
      dto.facilitySelected,
    );
    await this.assertFieldBelongsToVenue(
      courtKind,
      dto.fieldSelected,
      dto.venueId,
      tenantId,
    );

    const createDto: CreateBookingDto = {
      userId: dto.userId,
      sportType: 'futsal',
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
      pricing: {
        subTotal: 0,
        discount: 0,
        tax: 0,
        totalAmount: 0,
      },
      payment: {
        paymentStatus: 'pending',
        paymentMethod: 'cash',
      },
      bookingStatus: 'pending',
    };
    const created = await this.create(tenantId, createDto);
    return {
      message: 'Booking placed successfully',
      bookingId: created.bookingId,
      placedAt: created.createdAt,
    };
  }

  async placeCricketBooking(dto: PlaceCricketBookingDto): Promise<{
    message: string;
    bookingId: string;
    placedAt: string;
  }> {
    const loc = await this.locationRepo.findOne({ where: { id: dto.venueId } });
    if (!loc) {
      throw new NotFoundException(`Venue ${dto.venueId} not found`);
    }
    const business = await this.businessRepo.findOne({
      where: { id: loc.businessId },
    });
    if (!business) {
      throw new BadRequestException('Venue has no business record');
    }
    const tenantId = business.tenantId;
    const courtKind = this.normalizeCricketFacilityToCourtKind(
      dto.facilitySelected,
    );
    await this.assertFieldBelongsToVenue(
      courtKind,
      dto.fieldSelected,
      dto.venueId,
      tenantId,
    );

    const createDto: CreateBookingDto = {
      userId: dto.userId,
      sportType: 'cricket',
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
      pricing: {
        subTotal: 0,
        discount: 0,
        tax: 0,
        totalAmount: 0,
      },
      payment: {
        paymentStatus: 'pending',
        paymentMethod: 'cash',
      },
      bookingStatus: 'pending',
    };
    const created = await this.create(tenantId, createDto);
    return {
      message: 'Booking placed successfully',
      bookingId: created.bookingId,
      placedAt: created.createdAt,
    };
  }

  async placePadelBooking(dto: PlacePadelBookingDto): Promise<{
    message: string;
    bookingId: string;
    placedAt: string;
  }> {
    const loc = await this.locationRepo.findOne({ where: { id: dto.venueId } });
    if (!loc) {
      throw new NotFoundException(`Venue ${dto.venueId} not found`);
    }
    const business = await this.businessRepo.findOne({
      where: { id: loc.businessId },
    });
    if (!business) {
      throw new BadRequestException('Venue has no business record');
    }
    const tenantId = business.tenantId;
    const courtKind = this.normalizePadelFacilityToCourtKind(
      dto.facilitySelected,
    );
    await this.assertFieldBelongsToVenue(
      courtKind,
      dto.fieldSelected,
      dto.venueId,
      tenantId,
    );

    const createDto: CreateBookingDto = {
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
      pricing: {
        subTotal: 0,
        discount: 0,
        tax: 0,
        totalAmount: 0,
      },
      payment: {
        paymentStatus: 'pending',
        paymentMethod: 'cash',
      },
      bookingStatus: 'pending',
    };
    const created = await this.create(tenantId, createDto);
    return {
      message: 'Booking placed successfully',
      bookingId: created.bookingId,
      placedAt: created.createdAt,
    };
  }

  private normalizeFutsalFacilityToCourtKind(raw: string): CourtKind {
    const s = raw.trim().toLowerCase().replace(/-/g, '_');
    if (
      s === 'futsal_court' ||
      s === 'futsal_field' ||
      s === 'futsal' ||
      s === 'futsalfield' ||
      s === 'turf_court' ||
      s === 'turf' ||
      s === 'turfcourt'
    ) {
      return 'futsal_court';
    }
    throw new BadRequestException(
      `facilitySelected must be futsal_court (legacy futsal_field / turf_court accepted) (got ${raw})`,
    );
  }

  private normalizeCricketFacilityToCourtKind(raw: string): CourtKind {
    const s = raw.trim().toLowerCase().replace(/-/g, '_');
    if (
      s === 'cricket_court' ||
      s === 'cricket' ||
      s === 'pitch' ||
      s === 'cricket_pitch'
    ) {
      return 'cricket_court';
    }
    throw new BadRequestException(
      `facilitySelected must be cricket_court (legacy cricket / pitch accepted) (got ${raw})`,
    );
  }

  private normalizePadelFacilityToCourtKind(raw: string): CourtKind {
    const s = raw.trim().toLowerCase().replace(/-/g, '_');
    if (s === 'padel_court' || s === 'padel') {
      return 'padel_court';
    }
    throw new BadRequestException(
      `facilitySelected must be padel_court (legacy padel accepted) (got ${raw})`,
    );
  }

  private async assertFieldBelongsToVenue(
    courtKind: CourtKind,
    courtId: string,
    venueId: string,
    tenantId: string,
  ): Promise<void> {
    if (courtKind === 'futsal_court') {
      const row = await this.futsalCourtRepo.findOne({
        where: { id: courtId, tenantId },
      });
      if (!row || (row.businessLocationId ?? '') !== venueId) {
        throw new BadRequestException(
          'Futsal court does not belong to this venue',
        );
      }
      if (row.courtStatus !== 'active') {
        throw new BadRequestException(
          'Futsal court is not active and cannot be booked',
        );
      }
      return;
    }
    if (courtKind === 'cricket_court') {
      const row = await this.cricketCourtRepo.findOne({
        where: { id: courtId, tenantId },
      });
      if (!row || (row.businessLocationId ?? '') !== venueId) {
        throw new BadRequestException(
          'Cricket court does not belong to this venue',
        );
      }
      if (row.courtStatus !== 'active') {
        throw new BadRequestException(
          'Cricket court is not active and cannot be booked',
        );
      }
      return;
    }
    if (courtKind === 'padel_court') {
      const row = await this.padelRepo.findOne({
        where: { id: courtId, tenantId },
      });
      if (!row || (row.businessLocationId ?? '') !== venueId) {
        throw new BadRequestException(
          'Padel court does not belong to this venue',
        );
      }
      if (row.courtStatus !== 'active' || !row.isActive) {
        throw new BadRequestException(
          'Padel court is not active and cannot be booked',
        );
      }
      return;
    }
    throw new BadRequestException(`Unsupported court kind: ${courtKind}`);
  }
}
