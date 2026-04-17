import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { IamService } from '../iam/iam.service';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, In, Repository } from 'typeorm';
import { PadelCourt } from '../arena/padel-court/entities/padel-court.entity';
import { TurfCourt } from '../arena/turf/entities/turf-court.entity';
import { User } from '../iam/entities/user.entity';
import { TenantTimeSlotTemplateLine } from './entities/tenant-time-slot-template-line.entity';
import {
  COURT_SLOT_GRID_STEP_MINUTES,
  type BookingItemStatus,
  type BookingSportType,
  type BookingStatus,
  type CourtKind,
  type PaymentMethod,
  type PaymentStatus,
} from './types/booking.types';
import type { CreateBookingDto } from './dto/create-booking.dto';
import type { CreateBookingItemDto } from './dto/create-booking-item.dto';
import type { UpdateBookingDto } from './dto/update-booking.dto';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { Business } from '../businesses/entities/business.entity';
import type { PlacePadelBookingDto } from './dto/place-padel-booking.dto';
import { CourtFacilitySlot, CourtFacilitySlotStatus } from './entities/court-facility-slot.entity';
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

function toMinutes(time: any, isEndTime = false): number {
  if (typeof time !== 'string' || !time.includes(':')) return 0;
  if (time === '24:00' || (time === '00:00' && isEndTime)) return 24 * 60;
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

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type BookingApiRow = {
  bookingId: string;
  arenaId: string;
  arenaName?: string;
  userId: string;
  user?: {
    fullName?: string;
    email?: string;
    phone?: string;
  };
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
    @InjectRepository(PadelCourt)
    private readonly padelRepo: Repository<PadelCourt>,
    @InjectRepository(TurfCourt)
    private readonly turfRepo: Repository<TurfCourt>,
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
    @InjectRepository(TenantTimeSlotTemplateLine)
    private readonly slotTemplateLineRepo: Repository<TenantTimeSlotTemplateLine>,
    private readonly iamService: IamService,
  ) {}

  private readonly logger = new Logger(BookingsService.name);

  async resolveTenantIdByCourt(
    kind: CourtKind,
    courtId: string,
  ): Promise<string | null> {
    if (kind === 'padel_court') {
      const row = await this.padelRepo.findOne({
        where: { id: courtId },
        select: ['tenantId'],
      });
      return row?.tenantId ?? null;
    }
    if (kind === 'turf_court') {
      const row = await this.turfRepo.findOne({
        where: { id: courtId },
        select: ['tenantId'],
      });
      return row?.tenantId ?? null;
    }
    return null;
  }

  async resolveTenantIdByBooking(bookingId: string): Promise<string | null> {
    const row = await this.bookingRepo.findOne({
      where: { id: bookingId },
      select: ['tenantId'],
    });
    return row?.tenantId ?? null;
  }

  async resolveTenantIdByTimeSlotTemplate(
    templateId: string,
  ): Promise<string | null> {
    const row = await this.slotTemplateRepo.findOne({
      where: { id: templateId },
      select: ['tenantId'],
    });
    return row?.tenantId ?? null;
  }

  async resolveTenantIdByLocation(locationId: string): Promise<string | null> {
    const loc = await this.locationRepo.findOne({
      where: { id: locationId },
      select: ['businessId'],
    });
    if (!loc) return null;
    const business = await this.businessRepo.findOne({
      where: { id: loc.businessId },
      select: ['tenantId'],
    });
    return business?.tenantId ?? null;
  }

  private async resolveLocationMapping(booking: Booking): Promise<{
    locationsMap: Record<string, string>;
    courtToLocationMap: Record<string, string>;
  }> {
    const locationsMap: Record<string, string> = {};
    const courtToLocationMap: Record<string, string> = {};
    const firstItem = booking.items?.[0];

    if (firstItem) {
      if (firstItem.courtKind === 'padel_court') {
        const court = await this.padelRepo.findOne({
          where: { id: firstItem.courtId },
          relations: ['businessLocation'],
        });
        if (court?.businessLocation) {
          courtToLocationMap[court.id] = court.businessLocation.id;
          locationsMap[court.businessLocation.id] = court.businessLocation.name;
        }
      } else if (firstItem.courtKind === 'turf_court') {
        const court = await this.turfRepo.findOne({
          where: { id: firstItem.courtId },
        });
        if (court?.branchId) {
          courtToLocationMap[court.id] = court.branchId;
          const loc = await this.locationRepo.findOne({
            where: { id: court.branchId },
          });
          if (loc) locationsMap[loc.id] = loc.name;
        }
      }
    }
    return { locationsMap, courtToLocationMap };
  }
 
  private toApi(
    booking: Booking,
    locationsMap: Record<string, string> = {},
    courtToLocationMap: Record<string, string> = {},
  ): BookingApiRow {
    const first = booking.items?.[0];
    const courtId = first?.courtId;
    const locationId = courtId ? courtToLocationMap[courtId] : undefined;
    const arenaId = locationId || booking.tenantId;

    return {
      bookingId: booking.id,
      arenaId,
      arenaName: locationId ? locationsMap[locationId] : undefined,
      userId: booking.userId,
      user: booking.user
        ? {
            fullName: booking.user.fullName,
            email: booking.user.email,
            phone: booking.user.phone,
          }
        : undefined,
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

  async list(requesterUserId: string, tenantId?: string): Promise<BookingApiRow[]> {
    const isPlatformOwner = await this.iamService.hasAnyRole(requesterUserId, ['platform-owner']);
    
    const where: any = {};
    if (tenantId) {
      where.tenantId = tenantId;
    } else if (!isPlatformOwner) {
      // If not platform owner and no tenantId provided, they shouldn't see anything or we should find their businesses.
      // For now, let's assume they must provide a tenantId unless they are platform owner.
      throw new UnauthorizedException('Tenant ID is required');
    }

    const rows = await this.bookingRepo.find({
      where,
      relations: ['items', 'user'],
      order: { createdAt: 'DESC' },
    });

    // To improve performance, we fetch location mapping.
    const locationsMap: Record<string, string> = {};
    const courtToLocationMap: Record<string, string> = {};

    if (tenantId) {
      const business = await this.businessRepo.findOne({ where: { tenantId } });
      if (business) {
        const locations = await this.locationRepo.find({ where: { businessId: business.id } });
        for (const loc of locations) {
          locationsMap[loc.id] = loc.name;
        }
      }
      
      const padels = await this.padelRepo.find({ where: { tenantId }, select: ['id', 'businessLocationId'] });
      for (const p of padels) if (p.businessLocationId) courtToLocationMap[p.id] = p.businessLocationId;
      
      const turfs = await this.turfRepo.find({ where: { tenantId }, select: ['id', 'branchId'] });
      for (const t of turfs) if (t.branchId) courtToLocationMap[t.id] = t.branchId;
    } else {
      // Global view for platform-owner
      const locations = await this.locationRepo.find({ select: ['id', 'name'] });
      for (const loc of locations) locationsMap[loc.id] = loc.name;
      
      const padels = await this.padelRepo.find({ select: ['id', 'businessLocationId'] });
      for (const p of padels) if (p.businessLocationId) courtToLocationMap[p.id] = p.businessLocationId;
      
      const turfs = await this.turfRepo.find({ select: ['id', 'branchId'] });
      for (const t of turfs) if (t.branchId) courtToLocationMap[t.id] = t.branchId;
    }

    return rows.map((b) => this.toApi(b, locationsMap, courtToLocationMap));
  }

  async listByUserForProfile(userId: string): Promise<BookingApiRow[]> {
    const rows = await this.bookingRepo.find({
      where: { userId },
      relations: ['items', 'user'],
      order: { createdAt: 'DESC' },
    });
    // For profile, we might not have tenantId easily for batching locs,
    // so we'll just return with whatever we have or omit loc names here.
    return rows.map((b) => this.toApi(b));
  }

  async getOne(tenantId: string, bookingId: string): Promise<BookingApiRow> {
    const row = await this.bookingRepo.findOne({
      where: { id: bookingId, tenantId },
      relations: ['items', 'user'],
    });
    if (!row) throw new NotFoundException(`Booking ${bookingId} not found`);

    const { locationsMap, courtToLocationMap } =
      await this.resolveLocationMapping(row);

    return this.toApi(row, locationsMap, courtToLocationMap);
  }

  private async assertPadelCourtExists(
    tenantId: string,
    courtId: string,
  ): Promise<PadelCourt> {
    const court = await this.padelRepo.findOne({
      where: { id: courtId, tenantId },
    });
    if (!court)
      throw new BadRequestException(
        `Court ${courtId} not found for this tenant`,
      );
    if (court.courtStatus !== 'active' || court.isActive === false) {
      throw new BadRequestException('Selected court is not available');
    }
    return court;
  }

  private async assertTurfCourtExists(
    tenantId: string,
    courtId: string,
  ): Promise<TurfCourt> {
    const turf = await this.turfRepo.findOne({
      where: { id: courtId, tenantId },
    });
    if (!turf)
      throw new BadRequestException(
        `Turf ${courtId} not found for this tenant`,
      );
    if (turf.status !== 'active') {
      throw new BadRequestException('Selected turf is not available');
    }
    return turf;
  }

  private toSlotDateTimes(
    bookingDate: string,
    startTime: string,
    endTime: string,
  ) {
    const date = formatDateOnly(bookingDate);
    const overnight = toMinutes(endTime) <= toMinutes(startTime);
    return {
      startDatetime: new Date(`${date}T${startTime}:00Z`),
      endDatetime: new Date(
        `${overnight ? addDays(date, 1) : date}T${endTime}:00Z`,
      ),
    };
  }

  private assertBookingItem(item: CreateBookingItemDto): void {
    if (item.courtKind !== 'padel_court' && item.courtKind !== 'turf_court') {
      throw new BadRequestException(
        'Only padel_court and turf_court are supported',
      );
    }
    if (toMinutes(item.endTime) === toMinutes(item.startTime)) {
      throw new BadRequestException('endTime must be different from startTime');
    }
  }

  private async assertNoOverlap(
    tenantId: string,
    date: string,
    item: CreateBookingItemDto,
  ) {
    const { startDatetime } = this.toSlotDateTimes(
      date,
      item.startTime,
      item.endTime,
    );
    const overlaps = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.items', 'i')
      .where('b.tenantId = :tenantId', { tenantId })
      .andWhere("b.bookingStatus IN ('pending','confirmed')")
      .andWhere("i.itemStatus IN ('reserved','confirmed')")
      .andWhere('i.courtKind = :kind', { kind: item.courtKind })
      .andWhere('i.courtId = :courtId', { courtId: item.courtId })
      .andWhere('i.startDatetime = :startDatetime', {
        startDatetime: startDatetime.toISOString(),
      })
      .getCount();
    if (overlaps > 0)
      throw new BadRequestException('Selected slot is already booked');
  }

  async create(
    tenantId: string,
    dto: CreateBookingDto,
  ): Promise<BookingApiRow> {
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw new BadRequestException(`User ${dto.userId} not found`);

    for (const item of dto.items) {
      this.assertBookingItem(item);
      if (item.courtKind === 'padel_court') {
        await this.assertPadelCourtExists(tenantId, item.courtId);
        if (dto.sportType !== 'padel') {
          throw new BadRequestException('padel_court requires sportType=padel');
        }
      }
      if (item.courtKind === 'turf_court') {
        const turf = await this.assertTurfCourtExists(tenantId, item.courtId);
        if (dto.sportType !== 'futsal' && dto.sportType !== 'cricket') {
          throw new BadRequestException(
            'turf_court requires sportType=futsal or sportType=cricket',
          );
        }
        if (!turf.supportedSports.includes(dto.sportType)) {
          throw new BadRequestException(
            `Selected turf does not support ${dto.sportType}`,
          );
        }
      }
      await this.assertNoOverlap(tenantId, dto.bookingDate, item);
    }

    const itemsPayload: DeepPartial<BookingItem>[] = dto.items.map((i) => ({
      courtKind: i.courtKind,
      courtId: i.courtId,
      slotId: i.slotId,
      startTime: i.startTime,
      endTime: i.endTime,
      ...this.toSlotDateTimes(dto.bookingDate, i.startTime, i.endTime),
      price: dec(i.price),
      currency: i.currency ?? 'PKR',
      itemStatus: i.status ?? 'confirmed',
    }));

    const bookingPayload: DeepPartial<Booking> = {
      tenantId,
      userId: dto.userId,
      sportType: dto.sportType,
      bookingDate: formatDateOnly(dto.bookingDate),
      subTotal: dec(dto.pricing.subTotal),
      discount: dec(dto.pricing.discount),
      tax: dec(dto.pricing.tax),
      totalAmount: dec(dto.pricing.totalAmount),
      paymentStatus: dto.payment.paymentStatus,
      paymentMethod: dto.payment.paymentMethod,
      transactionId: dto.payment.transactionId,
      paidAt: dto.payment.paidAt ? new Date(dto.payment.paidAt) : undefined,
      bookingStatus: dto.bookingStatus ?? 'confirmed',
      notes: dto.notes,
      items: itemsPayload,
    };
    const booking = this.bookingRepo.create(bookingPayload);

    const saved = await this.bookingRepo.save(booking);

    const full = await this.bookingRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ['items', 'user'],
    });

    // Block the slots in the facility slots table
    await this.syncFacilitySlotsStatus(full);

    const { locationsMap, courtToLocationMap } =
      await this.resolveLocationMapping(full);
    return this.toApi(full, locationsMap, courtToLocationMap);
  }

  async update(
    tenantId: string,
    bookingId: string,
    dto: UpdateBookingDto,
  ): Promise<BookingApiRow> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId, tenantId },
      relations: ['items', 'user'],
    });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);

    if (dto.bookingStatus !== undefined)
      booking.bookingStatus = dto.bookingStatus;
    if (dto.notes !== undefined) booking.notes = dto.notes;
    if (dto.cancellationReason !== undefined)
      booking.cancellationReason = dto.cancellationReason;
    if (dto.payment?.paymentStatus !== undefined)
      booking.paymentStatus = dto.payment.paymentStatus;
    if (dto.payment?.paymentMethod !== undefined)
      booking.paymentMethod = dto.payment.paymentMethod;
    if (dto.payment?.transactionId !== undefined)
      booking.transactionId = dto.payment.transactionId;
    if (dto.payment?.paidAt !== undefined) {
      booking.paidAt = dto.payment.paidAt
        ? new Date(dto.payment.paidAt)
        : undefined;
    }
    if (dto.itemStatuses?.length) {
      const byId = new Map(booking.items.map((i) => [i.id, i]));
      for (const row of dto.itemStatuses) {
        const item = byId.get(row.itemId);
        if (!item)
          throw new BadRequestException(
            `Item ${row.itemId} not in this booking`,
          );
        item.itemStatus = row.status;
      }
    }
    const saved = await this.bookingRepo.save(booking);

    const full = await this.bookingRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ['items', 'user'],
    });

    await this.syncFacilitySlotsStatus(full);

    const { locationsMap, courtToLocationMap } =
      await this.resolveLocationMapping(full);
    return this.toApi(full, locationsMap, courtToLocationMap);
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
    params: {
      date: string;
      startTime: string;
      endTime: string;
      sportType?: BookingSportType;
    },
  ) {
    const date = formatDateOnly(params.date);
    const sport = params.sportType ?? 'padel';
    const isTurf = sport === 'futsal' || sport === 'cricket';

    // --- Fetch the right courts based on sportType ---
    type CourtRow = {
      id: string;
      name: string;
      pricePerSlot: string | null;
      slotDurationMinutes: number | null;
      courtKind: 'padel_court' | 'turf_court';
    };

    let allCourts: CourtRow[];
    if (isTurf) {
      const turfRows = await this.turfRepo.find({
        where: { tenantId, status: 'active' },
        select: ['id', 'name', 'slotDuration', 'pricing', 'supportedSports'],
      });
      allCourts = turfRows
        .filter((t) => t.supportedSports?.includes(sport))
        .map((t) => ({
          id: t.id,
          name: t.name,
          pricePerSlot: (t.pricing?.[sport as 'futsal' | 'cricket']?.basePrice) != null
              ? String(t.pricing[sport as 'futsal' | 'cricket']!.basePrice)
              : null,
          slotDurationMinutes: t.slotDuration ?? null,
          courtKind: 'turf_court' as const,
        }));
    } else {
      const padelRows = await this.padelRepo.find({
        where: { tenantId, isActive: true, courtStatus: 'active' },
        select: ['id', 'name', 'pricePerSlot', 'slotDurationMinutes'],
      });
      allCourts = padelRows.map((c) => ({
        id: c.id,
        name: c.name,
        pricePerSlot: c.pricePerSlot ?? null,
        slotDurationMinutes: c.slotDurationMinutes ?? null,
        courtKind: 'padel_court' as const,
      }));
    }

    // --- Find booked slots that overlap the requested window ---
    const courtKindFilter = isTurf ? 'turf_court' : 'padel_court';
    const busy = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.items', 'i')
      .where('b.tenantId = :tenantId', { tenantId })
      .andWhere('b.bookingDate = :date', { date })
      .andWhere("b.bookingStatus = 'confirmed'")
      .andWhere("i.itemStatus = 'confirmed'")
      .andWhere('i.courtKind = :courtKind', { courtKind: courtKindFilter })
      .andWhere('i.startTime < :end', { end: params.endTime === '00:00' ? '24:00' : params.endTime })
      .andWhere('i.endTime > :start', { start: params.startTime })
      .select([
        'i.courtId AS courtId',
        'i.courtKind AS courtKind',
        'i.startTime AS startTime',
        'i.endTime AS endTime',
        'b.id AS bookingId',
        'i.id AS id',
        'i.itemStatus AS itemStatus',
      ])
      .getRawMany<{
        courtId: string;
        courtKind: string;
        startTime: string;
        endTime: string;
        bookingId: string;
        id: string;
        itemStatus: BookingItemStatus;
      }>();

    const busyIds = new Set(busy.map((x) => x.courtId));

    // --- Also check for slots explicitly marked as "blocked" (e.g. via templates) ---
    const blocked = await this.facilitySlotRepo.find({
      where: {
        tenantId,
        courtKind: courtKindFilter,
        slotDate: date,
        status: 'blocked',
      },
      select: ['courtId', 'startTime', 'endTime'],
    });

    const blockedIds = new Set<string>();
    for (const fs of blocked) {
      if (
        toMinutes(fs.startTime, false) < toMinutes(params.endTime, true) &&
        toMinutes(fs.endTime, true) > toMinutes(params.startTime, false)
      ) {
        blockedIds.add(fs.courtId);
      }
    }
    return {
      date,
      startTime: params.startTime,
      endTime: params.endTime,
      sportType: sport,
      availableCourts: allCourts
        .filter((c) => !busyIds.has(c.id) && !blockedIds.has(c.id))
        .map((c) => ({
          kind: c.courtKind,
          id: c.id,
          name: c.name,
          pricePerSlot: c.pricePerSlot ? Number(c.pricePerSlot) : null,
          slotDurationMinutes: c.slotDurationMinutes ?? null,
        })),
      bookedSlots: busy.map((x) => ({
        kind: x.courtKind,
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
    params: {
      kind: CourtKind;
      courtId: string;
      date: string;
      startTime?: string;
      endTime?: string;
      availableOnly?: boolean;
    },
  ) {
    if (params.kind === 'padel_court') {
      await this.assertPadelCourtExists(tenantId, params.courtId);
    } else if (params.kind === 'turf_court') {
      await this.assertTurfCourtExists(tenantId, params.courtId);
    } else {
      throw new BadRequestException('Unsupported court kind');
    }
    const date = formatDateOnly(params.date);
    const start = toMinutes(params.startTime ?? '00:00', false);
    const end = toMinutes(params.endTime ?? '24:00', true);

    // Instead of completely generating grid steps, we will read the real slots from court_facility_slots
    // if they exist for this court and date, falling back to the 60 min loop if nothing exists.
    const facilitySlots = await this.facilitySlotRepo.find({
      where: {
        tenantId,
        courtKind: params.kind,
        courtId: params.courtId,
        slotDate: date,
      },
      order: { startTime: 'ASC' },
    });

    const rows = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.items', 'i')
      .where('b.tenantId = :tenantId', { tenantId })
      .andWhere('b.bookingDate = :date', { date })
      .andWhere("b.bookingStatus = 'confirmed'")
      .andWhere("i.itemStatus = 'confirmed'")
      .andWhere('i.courtKind = :kind', { kind: params.kind })
      .andWhere('i.courtId = :courtId', { courtId: params.courtId })
      .select([
        'b.id AS bookingId',
        'i.id AS id',
        'i.startTime AS startTime',
        'i.endTime AS endTime',
        'i.itemStatus AS itemStatus',
      ])
      .getRawMany<{
        bookingId: string;
        id: string;
        startTime: string;
        endTime: string;
        itemStatus: BookingItemStatus;
      }>();

    let slots: Array<any> = [];
    if (facilitySlots.length > 0) {
      for (const fs of facilitySlots) {
        if (toMinutes(fs.startTime, false) >= end || toMinutes(fs.endTime, true) <= start)
          continue;
        const hit = rows.find(
          (r) =>
            toMinutes(r.startTime, false) < toMinutes(fs.endTime, true) &&
            toMinutes(r.endTime, true) > toMinutes(fs.startTime, false),
        );
        if (hit) {
          slots.push({
            startTime: fs.startTime,
            endTime: fs.endTime,
            availability: 'booked',
            bookingId: hit.bookingId,
            itemId: hit.id,
            status: hit.itemStatus,
          });
        } else if (fs.status === 'blocked') {
          slots.push({
            startTime: fs.startTime,
            endTime: fs.endTime,
            availability: 'blocked',
          });
        } else {
          slots.push({
            startTime: fs.startTime,
            endTime: fs.endTime,
            availability: 'available',
          });
        }
      }
    } else {
      // Fallback if no template slots were created
      for (let m = start; m < end; m += COURT_SLOT_GRID_STEP_MINUTES) {
        const s = minutesToTimeString(m);
        const e = minutesToTimeString(m + COURT_SLOT_GRID_STEP_MINUTES);
        const hit = rows.find(
          (r) =>
            toMinutes(r.startTime, false) < toMinutes(e, true) &&
            toMinutes(r.endTime, true) > toMinutes(s, false),
        );
        if (hit) {
          slots.push({
            startTime: s,
            endTime: e,
            availability: 'booked',
            bookingId: hit.bookingId,
            itemId: hit.id,
            status: hit.itemStatus,
          });
        } else {
          slots.push({ startTime: s, endTime: e, availability: 'available' });
        }
      }
    }

    if (params.availableOnly) {
      slots = slots.filter((s) => s.availability === 'available');
    }

    // --- Filter out past slots (today and older) ---
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    const hh = parts.find((p) => p.type === 'hour')?.value;
    const mm = parts.find((p) => p.type === 'minute')?.value;

    const todayStr = `${y}-${m}-${d}`;
    const currentTimeStr = `${hh}:${mm}`;

    if (date < todayStr) {
      slots = [];
    } else if (date === todayStr) {
      slots = slots.filter((s) => s.startTime >= currentTimeStr);
    }

    return { date, kind: params.kind, courtId: params.courtId, slots };
  }

  async getCourtSlotGrid(
    tenantId: string,
    params: {
      kind: CourtKind;
      courtId: string;
      date: string;
      startTime?: string;
      endTime?: string;
      availableOnly?: boolean;
    },
  ) {
    const data = await this.getCourtSlots(tenantId, {
      ...params,
      availableOnly: false,
    });
    let segments = data.slots.map((s: any) =>
      s.availability === 'booked'
        ? {
            startTime: s.startTime,
            endTime: s.endTime,
            state: 'booked',
            bookingId: s.bookingId,
            itemId: s.itemId,
            status: s.status,
          }
        : s.availability === 'blocked'
          ? { startTime: s.startTime, endTime: s.endTime, state: 'blocked' }
          : { startTime: s.startTime, endTime: s.endTime, state: 'free' },
    );

    // segments is already filtered for past slots by getCourtSlots call above.

    if (params.availableOnly) {
      segments = segments.filter((s: any) => s.state === 'free');
    } else {
      // User specifically requested to not show booked slots as part of recent iteration,
      // ensuring booked slots are purged across the board
      segments = segments.filter((s: any) => s.state !== 'booked');
    }

    return {
      date: data.date,
      kind: data.kind,
      courtId: data.courtId,
      segmentMinutes: COURT_SLOT_GRID_STEP_MINUTES,
      gridStartTime: params.startTime ?? '00:00',
      gridEndTime: params.endTime ?? '24:00',
      availableOnly: params.availableOnly || undefined,
      segments,
    };
  }

  async generateDayFacilitySlots(
    tenantId: string,
    params: { kind: CourtKind; courtId: string; date: string },
  ): Promise<{ ok: true; upserted: number }> {
    let templateId: string | null = null;
    if (params.kind === 'padel_court') {
      const court = await this.assertPadelCourtExists(tenantId, params.courtId);
      templateId = court.timeSlotTemplateId;
    } else if (params.kind === 'turf_court') {
      const court = await this.assertTurfCourtExists(tenantId, params.courtId);
      templateId = court.timeSlotTemplateId;
    } else {
      throw new BadRequestException('Unsupported court kind');
    }

    const date = formatDateOnly(params.date);
    const values: Partial<CourtFacilitySlot>[] = [];

    let templateLines: TenantTimeSlotTemplateLine[] = [];
    if (templateId) {
      templateLines = await this.slotTemplateLineRepo.find({
        where: { templateId, tenantId },
      });
    }

    if (templateLines.length > 0) {
      for (const line of templateLines) {
        values.push({
          tenantId,
          courtKind: params.kind,
          courtId: params.courtId,
          slotDate: date,
          startTime: line.startTime,
          endTime: line.endTime,
          status: line.status as any,
        });
      }
    } else {
      for (let m = 0; m < 24 * 60; m += COURT_SLOT_GRID_STEP_MINUTES) {
        values.push({
          tenantId,
          courtKind: params.kind,
          courtId: params.courtId,
          slotDate: date,
          startTime: minutesToTimeString(m),
          endTime: minutesToTimeString(m + COURT_SLOT_GRID_STEP_MINUTES),
          status: 'available',
        });
      }
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
    params: {
      kind: CourtKind;
      courtId: string;
      date: string;
      startTime: string;
      status: 'available' | 'blocked';
    },
  ) {
    if (params.kind === 'padel_court') {
      await this.assertPadelCourtExists(tenantId, params.courtId);
    } else if (params.kind === 'turf_court') {
      await this.assertTurfCourtExists(tenantId, params.courtId);
    } else {
      throw new BadRequestException('Unsupported court kind');
    }
    await this.facilitySlotRepo.upsert(
      {
        tenantId,
        courtKind: params.kind,
        courtId: params.courtId,
        slotDate: formatDateOnly(params.date),
        startTime: params.startTime,
        endTime: minutesToTimeString(
          toMinutes(params.startTime) + COURT_SLOT_GRID_STEP_MINUTES,
        ),
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
    return { ok: true };
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
  ) {
    if (params.kind === 'padel_court') {
      await this.assertPadelCourtExists(tenantId, params.courtId);
    } else if (params.kind === 'turf_court') {
      await this.assertTurfCourtExists(tenantId, params.courtId);
    } else {
      throw new BadRequestException('Unsupported court kind');
    }
    const where = {
      tenantId,
      courtKind: params.kind,
      courtId: params.courtId,
      blockDate: formatDateOnly(params.date),
      startTime: params.startTime,
    };
    if (params.blocked) {
      const existing = await this.slotBlockRepo.findOne({ where });
      if (!existing)
        await this.slotBlockRepo.save(this.slotBlockRepo.create(where));
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
    const start = params.startTime ?? '00:00';
    const end = params.endTime ?? '24:00';
    const kinds = this.normalizeKindForAvail(params.courtType);

    const padelBatch = kinds.includes('padel_court')
      ? await this.padelRepo.find({
          where: { businessLocationId: params.locationId, isActive: true, courtStatus: In(['active', 'draft']) as any },
          select: ['id', 'name', 'tenantId', 'pricePerSlot'],
        })
      : [];

    const turfBatch = kinds.includes('turf_court')
      ? await this.turfRepo.find({
          where: { branchId: params.locationId, status: 'active' },
          select: ['id', 'name', 'tenantId', 'pricing', 'supportedSports'],
        })
      : [];

    const facilities: Array<{
      kind: CourtKind;
      courtId: string;
      name: string;
      price?: number;
      slots: Array<{ startTime: string; endTime: string }>;
    }> = [];

    for (const court of padelBatch) {
      const grid = await this.getCourtSlotGrid(court.tenantId, {
        kind: 'padel_court',
        courtId: court.id,
        date,
        startTime: start,
        endTime: end,
        availableOnly: true,
      });
      facilities.push({
        kind: 'padel_court',
        courtId: court.id,
        name: court.name,
        price: Number(court.pricePerSlot || 0),
        slots: grid.segments.map((s: any) => ({ startTime: s.startTime, endTime: s.endTime })),
      });
    }

    for (const court of turfBatch) {
      const grid = await this.getCourtSlotGrid(court.tenantId, {
        kind: 'turf_court',
        courtId: court.id,
        date,
        startTime: start,
        endTime: end,
        availableOnly: true,
      });
      facilities.push({
        kind: 'turf_court',
        courtId: court.id,
        name: court.name,
        price: this.resolveTurfPrice(court, params.courtType),
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
      courtType: params.courtType ?? 'all',
      facilities,
      unionSlots: [...unionMap.values()].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    };
  }

  private resolveTurfPrice(turf: any, requestedType?: string): number {
    const s = (requestedType || '').toLowerCase();
    const pricing = turf.pricing || {};
    let priceObj: any = null;

    if (s.includes('futsal')) priceObj = pricing.futsal;
    else if (s.includes('cricket')) priceObj = pricing.cricket;

    if (!priceObj) {
      const firstSport = turf.supportedSports?.[0];
      if (firstSport) priceObj = pricing[firstSport];
    }
    return Number(priceObj?.basePrice ?? 0);
  }

  async getLocationFacilitiesAvailableForSlot(params: {
    locationId: string;
    date: string;
    startTime: string;
    endTime?: string;
    courtType?: string;
  }) {
    const date = formatDateOnly(params.date);
    const nextDate = addDays(date, 1);
    const start = params.startTime ?? '09:00';
    const end =
      params.endTime ??
      minutesToTimeString(toMinutes(start, false) + COURT_SLOT_GRID_STEP_MINUTES);

    const kinds = this.normalizeKindForAvail(params.courtType);

    const padelBatch = kinds.includes('padel_court')
      ? await this.padelRepo.find({
          where: {
            businessLocationId: params.locationId,
            isActive: true,
            courtStatus: In(['active', 'draft']) as any,
          },
          select: ['id', 'name', 'tenantId', 'pricePerSlot'],
        })
      : [];

    const turfBatch = kinds.includes('turf_court')
      ? await this.turfRepo.find({
          where: { branchId: params.locationId, status: 'active' },
          select: ['id', 'name', 'tenantId', 'pricing', 'supportedSports'],
        })
      : [];

    const allCourts = [
      ...padelBatch.map((c) => ({ ...c, kind: 'padel_court' as const })),
      ...turfBatch.map((c) => ({ ...c, kind: 'turf_court' as const })),
    ];

    const getFacilitiesForDate = async (targetDate: string) => {
      const results = await Promise.all(
        allCourts.map(async (c) => {
          const slots = await this.getCourtSlots(c.tenantId, {
            kind: c.kind,
            courtId: c.id,
            date: targetDate,
            startTime: start,
            endTime: end,
          });
          const isAvailable = slots.slots.some(
            (s: any) =>
              s.startTime === params.startTime &&
              s.endTime === end &&
              s.availability === 'available',
          );
          return isAvailable
            ? {
                kind: c.kind,
                courtId: c.id,
                name: c.name,
                price:
                  c.kind === 'padel_court'
                    ? Number((c as any).pricePerSlot ?? 0)
                    : this.resolveTurfPrice(c, params.courtType),
              }
            : null;
        }),
      );
      return results.filter(
        (f): f is { kind: CourtKind; courtId: string; name: string; price: number } =>
          f !== null,
      );
    };

    const [facilities, nextDayFacilities] = await Promise.all([
      getFacilitiesForDate(date),
      getFacilitiesForDate(nextDate),
    ]);

    return {
      date,
      nextDayDate: nextDate,
      locationId: params.locationId,
      startTime: params.startTime,
      endTime: end,
      facilities,
      nextDayFacilities,
    };
  }

  private normalizePadelFacilityToCourtKind(raw: string): CourtKind {
    const s = raw.trim().toLowerCase().replace(/-/g, '_');
    if (s === 'padel' || s === 'padel_court') return 'padel_court';
    if (s === 'futsal' || s === 'cricket' || s === 'turf' || s === 'turf_court')
      return 'turf_court';
    throw new BadRequestException('Invalid facilitySelected type');
  }

  private normalizeKindForAvail(raw?: string): CourtKind[] {
    if (!raw) return ['padel_court', 'turf_court'];
    const s = raw.toLowerCase().trim();
    if (s === 'padel' || s === 'padel_court') return ['padel_court'];
    if (s === 'futsal' || s === 'cricket' || s === 'turf' || s === 'turf_court')
      return ['turf_court'];
    return ['padel_court', 'turf_court'];
  }

  async placePadelBooking(
    dto: PlacePadelBookingDto,
  ): Promise<{ message: string; bookingId: string; placedAt: string }> {
    const loc = await this.locationRepo.findOne({ where: { id: dto.venueId } });
    if (!loc) throw new NotFoundException(`Venue ${dto.venueId} not found`);
    const business = await this.businessRepo.findOne({
      where: { id: loc.businessId },
    });
    if (!business)
      throw new BadRequestException('Venue has no business record');
    const tenantId = business.tenantId;
    const courtKind = this.normalizePadelFacilityToCourtKind(
      dto.facilitySelected,
    );
    const court = await this.assertPadelCourtExists(
      tenantId,
      dto.fieldSelected,
    );
    if ((court.businessLocationId ?? '') !== dto.venueId) {
      throw new BadRequestException(
        'Selected court does not belong to this venue',
      );
    }

    const price = Number(court.pricePerSlot || 0);

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
          price,
          currency: loc.currency ?? 'PKR',
          status: 'confirmed',
        },
      ],
      pricing: { subTotal: price, discount: 0, tax: 0, totalAmount: price },
      payment: { paymentStatus: 'pending', paymentMethod: 'cash' },
      bookingStatus: 'confirmed',
    });
    return {
      message: 'Booking placed successfully',
      bookingId: booking.bookingId,
      placedAt: booking.createdAt,
    };
  }

  async syncFacilitySlotsStatusById(
    tenantId: string,
    bookingId: string,
  ): Promise<void> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId, tenantId },
      relations: ['items'],
    });
    if (!booking) return;
    await this.syncFacilitySlotsStatus(booking);
  }

  private async syncFacilitySlotsStatus(booking: Booking): Promise<void> {
    if (!booking.items?.length) return;

    // Use 'blocked' as requested by user
    const targetStatus: CourtFacilitySlotStatus =
      booking.bookingStatus === 'confirmed' ||
      booking.bookingStatus === 'completed'
        ? 'blocked'
        : 'available';

    for (const item of booking.items) {
      const startMinutes = toMinutes(item.startTime, false);
      const endMinutes = toMinutes(item.endTime, true);

      for (
        let m = startMinutes;
        m < endMinutes;
        m += COURT_SLOT_GRID_STEP_MINUTES
      ) {
        const timeStr = minutesToTimeString(m);
        await this.facilitySlotRepo.update(
          {
            tenantId: booking.tenantId,
            courtKind: item.courtKind,
            courtId: item.courtId,
            slotDate: booking.bookingDate,
            startTime: timeStr,
          },
          { status: targetStatus },
        );
      }
    }
  }

  async completePastBookings() {
    const now = new Date();
    
    // Find confirmed bookings where all items have ended
    const pastBookings = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.items', 'i')
      .where("b.bookingStatus = 'confirmed'")
      .groupBy('b.id')
      .having('MAX(i.endDatetime) < :now', { now: now.toISOString() })
      .select('b.id', 'id')
      .getRawMany();

    if (pastBookings.length === 0) return;

    const ids = pastBookings.map((b) => b.id);
    await this.bookingRepo.update({ id: In(ids) }, { bookingStatus: 'completed' });
    this.logger.log(`Marked ${ids.length} confirmed bookings as completed.`);
  }
}
