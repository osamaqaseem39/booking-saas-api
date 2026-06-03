import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { IamService } from '../iam/iam.service';
import { RealtimeService } from '../realtime/realtime.service';
import type { BookingRealtimeAction } from '../realtime/realtime.events';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  Brackets,
  DeepPartial,
  FindOptionsWhere,
  In,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { PadelCourt } from '../arena/padel-court/entities/padel-court.entity';
import { TableTennisCourt } from '../arena/table-tennis-court/entities/table-tennis-court.entity';
import { TurfCourt } from '../arena/turf/entities/turf-court.entity';
import { User } from '../iam/entities/user.entity';
import { TenantTimeSlotTemplateLine } from './entities/tenant-time-slot-template-line.entity';
import {
  type BookingItemStatus,
  type BookingSportType,
  type BookingStatus,
  type BookingViewStatus,
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
import type {
  LiveFacilitiesSlotsPayload,
  LivePadelCourtDto,
  LiveTurfCourtDto,
  LocationLiveFacilitiesView,
} from './dto/location-live-facilities-view.dto';
import {
  addDaysYmd,
  buildPlaySnapshot,
  type FacilityPlaySnapshot,
  wallRangeToMs,
  ymdInTimeZone,
} from './utils/facility-live-snapshot.util';
import {
  getWorkingDayWindow,
  isOvernightContinuationSlot,
  isOvernightWorkingWindow,
} from './utils/working-hours.util';
import {
  fetchGeminiBookingExtract,
  isGeminiBookingParseConfigured,
  mergeGeminiOverHeuristic,
} from './utils/gemini-free-text-parse.util';
import {
  fetchOpenAiBookingExtract,
  isOpenAiBookingParseConfigured,
} from './utils/openai-free-text-parse.util';
import {
  parseFreeTextBookingMessage,
  type FreeTextBookingParseResult,
} from './utils/parse-free-text-booking.util';
import { CourtFacilitySlot, CourtFacilitySlotStatus } from './entities/court-facility-slot.entity';
import { BookingItem } from './entities/booking-item.entity';
import { CourtSlotBookingBlock } from './entities/court-slot-booking-block.entity';
import { Booking } from './entities/booking.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { TenantTimeSlotTemplate } from './entities/tenant-time-slot-template.entity';
import {
  bookingItemCoversFacilitySlotOnGridDate,
  buildItemFacilitySlotSyncWindows,
  facilitySlotEffectiveEndTime,
  facilitySlotMarkingWallEnd,
  facilitySlotOverlapsWallWindow,
  facilitySlotStartInMarkWindow,
  filterSlotsForBookingPicker,
  resolveBookingMatchEndTime,
  wallSlotOverlapsWindow,
} from './utils/slot-wall-time.util';
import {
  bookingProcessError,
  bookingProcessStep,
  bookingProcessWarn,
  summarizeActiveBookingItems,
  summarizeCreateItems,
  summarizeSlotAvailability,
} from './utils/booking-process-log.util';

function dec(n: number): string {
  return Number(n).toFixed(2);
}

function numFromDec(v: string): number {
  return Number.parseFloat(v);
}

/**
 * When paid amount matches the order total, mark payment as settled unless already in a terminal failure/refund state.
 */
function harmonizePaymentStatusWithAmounts(b: {
  totalAmount: string;
  paidAmount: string;
  paymentStatus: PaymentStatus;
}): void {
  if (b.paymentStatus === 'refunded' || b.paymentStatus === 'failed') return;
  const total = numFromDec(b.totalAmount);
  const paid = numFromDec(b.paidAmount);
  if (paid <= 0) {
    b.paymentStatus = 'pending';
  } else if (paid < total) {
    b.paymentStatus = 'partially_paid';
  } else if (paid === total) {
    b.paymentStatus = 'paid';
  }
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

function diffMinutes(startTime: string, endTime: string): number {
  const start = toMinutes(startTime, false);
  let end = toMinutes(endTime, true);
  if (end <= start) end += 24 * 60;
  return end - start;
}

type TableTennisPlayType = 'singles' | 'doubles';

function getCurrentDateInKarachi(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function getCurrentMinutesInKarachi(): number {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [hourText = '00', minuteText = '00'] = formatter
    .format(new Date())
    .split(':');
  return Number(hourText) * 60 + Number(minuteText);
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
  /** Whole booking wall clock: first active item `startTime` → last active item `endTime` (`HH:mm`). */
  startTime?: string;
  endTime?: string;
  items: Array<{
    id: string;
    date?: string;
    courtKind: CourtKind;
    courtId: string;
    courtName?: string;
    slotId?: string;
    startTime: string;
    endTime: string;
    /** Stored line amount before projected live overtime; same as `price` when not projecting. */
    basePrice: number;
    /** Projected live overtime charge for this line; 0 when none. */
    overtimeCharge: number;
    /** Projected live overtime minutes for this line; 0 when none. */
    overtimeMinutes: number;
    /** `basePrice + overtimeCharge` (matches persisted total after materialization). */
    price: number;
    currency: string;
    status: BookingItemStatus;
  }>;
  pricing: {
    /** Subtotal including projected live overtime when applicable (unchanged semantics). */
    subTotal: number;
    /** Stored booking subtotal before current live overtime projection is merged into `subTotal`. */
    baseSubTotal: number;
    /** Portion of the live view attributable to projected overtime only; 0 when not projecting. */
    overtimeAmount: number;
    discount: number;
    tax: number;
    totalAmount: number;
  };
  payment: {
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    transactionId?: string;
    paidAt?: string;
    paidAmount: number;
    remainingAmount: number;
  };
  paymentTransactions?: Array<{
    id: string;
    method: PaymentMethod;
    amount: number;
    bankAccountId?: string;
    transactionRef?: string;
    note?: string;
    paidAt: string;
  }>;
  bookingStatus: BookingViewStatus;
  /**
   * When a booking is still `live` past the scheduled item end, projected overtime charges
   * (same formula as completion persistence) are merged into `items[].price` and `pricing`.
   */
  liveOvertime?: {
    projectedAt: string;
    totalOvertimeMinutes: number;
    totalOvertimeCharge: number;
  };
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
    @InjectRepository(TableTennisCourt)
    private readonly tableTennisRepo: Repository<TableTennisCourt>,
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
    @InjectRepository(PaymentTransaction)
    private readonly paymentTxnRepo: Repository<PaymentTransaction>,
    private readonly iamService: IamService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  private readonly logger = new Logger(BookingsService.name);

  private notifyBookingChange(
    tenantId: string,
    bookingId: string,
    action: BookingRealtimeAction,
  ): void {
    this.realtime?.emitBookingChange(tenantId, bookingId, action);
  }

  private computePayableAmount(
    subTotal: number,
    discount: number,
    tax: number,
  ): number {
    return Math.max(0, Number((subTotal - discount + tax).toFixed(2)));
  }

  private assertPaidAmountWithinPayable(
    paidAmount: number,
    payableAmount: number,
  ): void {
    if (paidAmount > payableAmount) {
      throw new BadRequestException(
        'paidAmount cannot be greater than payable amount',
      );
    }
  }
  private static readonly MAX_BOOKING_DAYS_AHEAD = 14;
  private static readonly DEFAULT_SLOT_STEP_MINUTES = 60;
  private static readonly SLOT_OVERLAP_GRACE_MINUTES = 15;

  private assertBookingDateInAllowedWindow(bookingDate: string): void {
    const requested = formatDateOnly(bookingDate);
    const today = getCurrentDateInKarachi();
    const lastAllowed = addDays(
      today,
      BookingsService.MAX_BOOKING_DAYS_AHEAD - 1,
    );
    if (requested < today || requested > lastAllowed) {
      throw new BadRequestException(
        `Bookings are allowed only from ${today} to ${lastAllowed}`,
      );
    }
  }

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
    if (kind === 'table_tennis_court') {
      const row = await this.tableTennisRepo.findOne({
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

  private async resolveLocationMappingBatch(bookings: Booking[]): Promise<{
    locationsMap: Record<string, string>;
    courtToLocationMap: Record<string, string>;
    locationTimeZoneMap: Record<string, string>;
    courtNamesMap: Record<string, string>;
  }> {
    const locationsMap: Record<string, string> = {};
    const courtToLocationMap: Record<string, string> = {};
    const locationTimeZoneMap: Record<string, string> = {};
    const courtNamesMap: Record<string, string> = {};

    const padelIds = new Set<string>();
    const turfIds = new Set<string>();
    const tableTennisIds = new Set<string>();

    for (const b of bookings) {
      for (const item of b.items || []) {
        if (item.courtKind === 'padel_court') padelIds.add(item.courtId);
        else if (item.courtKind === 'turf_court') turfIds.add(item.courtId);
        else if (item.courtKind === 'table_tennis_court')
          tableTennisIds.add(item.courtId);
      }
    }

    if (padelIds.size > 0) {
      const padels = await this.padelRepo.find({
        where: { id: In([...padelIds]) },
        select: ['id', 'businessLocationId', 'name'],
      });
      for (const p of padels) {
        courtNamesMap[p.id] = p.name;
        if (p.businessLocationId)
          courtToLocationMap[p.id] = p.businessLocationId;
      }
    }

    if (turfIds.size > 0) {
      const turfs = await this.turfRepo.find({
        where: { id: In([...turfIds]) },
        select: ['id', 'branchId', 'name'],
      });
      for (const t of turfs) {
        courtNamesMap[t.id] = t.name;
        if (t.branchId) courtToLocationMap[t.id] = t.branchId;
      }
    }

    if (tableTennisIds.size > 0) {
      const rows = await this.tableTennisRepo.find({
        where: { id: In([...tableTennisIds]) },
        select: ['id', 'businessLocationId', 'name'],
      });
      for (const t of rows) {
        courtNamesMap[t.id] = t.name;
        if (t.businessLocationId) courtToLocationMap[t.id] = t.businessLocationId;
      }
    }

    const locationIds = new Set(Object.values(courtToLocationMap));
    if (locationIds.size > 0) {
      const locations = await this.locationRepo.find({
        where: { id: In([...locationIds]) },
        select: ['id', 'name', 'timezone'],
      });
      for (const loc of locations) {
        locationsMap[loc.id] = loc.name;
        const tz = loc.timezone?.trim();
        if (tz) locationTimeZoneMap[loc.id] = tz;
      }
    }

    return { locationsMap, courtToLocationMap, locationTimeZoneMap, courtNamesMap };
  }

  private async resolveLocationMapping(booking: Booking): Promise<{
    locationsMap: Record<string, string>;
    courtToLocationMap: Record<string, string>;
    locationTimeZoneMap: Record<string, string>;
    courtNamesMap: Record<string, string>;
  }> {
    return this.resolveLocationMappingBatch([booking]);
  }

  /** Start instant for overlap / ordering; prefers persisted `startDatetime`. */
  private itemPlayStartMs(item: BookingItem, bookingBookingDate: string): number {
    if (item.startDatetime) return item.startDatetime.getTime();
    const d = formatDateOnly(item.date ?? bookingBookingDate);
    return this.toSlotDateTimes(d, item.startTime, item.endTime).startDatetime.getTime();
  }

  private sortBookingItemsForTimeline(booking: Booking): BookingItem[] {
    const arr = [...(booking.items ?? [])];
    const bd = formatDateOnly(booking.bookingDate);
    arr.sort((a, b) => this.itemPlayStartMs(a, bd) - this.itemPlayStartMs(b, bd));
    return arr;
  }

  private itemPlayEndMs(item: BookingItem, bookingBookingDate: string): number {
    if (item.endDatetime) return item.endDatetime.getTime();
    const d = formatDateOnly(item.date ?? bookingBookingDate);
    return this.toSlotDateTimes(d, item.startTime, item.endTime).endDatetime.getTime();
  }

  /** Earliest active segment start and latest active segment end (wall `HH:mm` on their line dates). */
  private computeBookingWindowWallTimes(booking: Booking): {
    startTime: string;
    endTime: string;
  } | null {
    const items = (booking.items ?? []).filter((i) => i.itemStatus !== 'cancelled');
    if (!items.length) return null;
    const bd = formatDateOnly(booking.bookingDate);
    let minMs = Number.POSITIVE_INFINITY;
    let maxMs = Number.NEGATIVE_INFINITY;
    let startTime = '';
    let endTime = '';
    for (const it of items) {
      const s = this.itemPlayStartMs(it, bd);
      const e = this.itemPlayEndMs(it, bd);
      if (s < minMs) {
        minMs = s;
        startTime = it.startTime;
      }
      if (e > maxMs) {
        maxMs = e;
        endTime = it.endTime;
      }
    }
    if (!startTime || !endTime) return null;
    return { startTime, endTime };
  }

  private applyBookingWindowFields(booking: Booking): void {
    const w = this.computeBookingWindowWallTimes(booking);
    if (w) {
      booking.startTime = w.startTime;
      booking.endTime = w.endTime;
    } else {
      booking.startTime = null;
      booking.endTime = null;
    }
  }

  /**
   * Mirrors `completePastBookings` overtime math without mutating the entity.
   * Only applies while the booking is still marked `live`.
   */
  private computeLiveOvertimeProjection(
    booking: Booking,
    now: Date,
    courtToLocationMap: Record<string, string> = {},
    locationTimeZoneMap: Record<string, string> = {},
  ): {
    perItem: Record<string, { overtimeMinutes: number; overtimeCharge: number }>;
    totalOvertimeMinutes: number;
    totalOvertimeCharge: number;
    projectedAt: string;
  } | null {
    if (booking.bookingStatus !== 'live') return null;

    const bd = formatDateOnly(booking.bookingDate);
    const perItem: Record<string, { overtimeMinutes: number; overtimeCharge: number }> = {};
    let totalOvertimeMinutes = 0;
    let totalOvertimeCharge = 0;

    for (const item of booking.items ?? []) {
      if (item.itemStatus === 'cancelled') continue;

      const ymd = formatDateOnly(item.date ?? booking.bookingDate);
      const locId = courtToLocationMap[item.courtId];
      const rawTz = locId ? locationTimeZoneMap[locId] : undefined;
      const { startMs, endMs } =
        rawTz?.trim()
          ? wallRangeToMs(ymd, item.startTime, item.endTime, rawTz)
          : {
              startMs: this.itemPlayStartMs(item, bd),
              endMs: this.itemPlayEndMs(item, bd),
            };
      if (now.getTime() <= endMs) continue;

      const durationMinutes = Math.max(
        1,
        Math.round((endMs - startMs) / 60000),
      );
      const basePrice = numFromDec(item.price);
      const perMinuteRate = basePrice / durationMinutes;
      const overtimeMinutes = Math.max(
        0,
        Math.ceil((now.getTime() - endMs) / 60000),
      );
      if (overtimeMinutes <= 0) continue;

      const overtimeCharge = Number((perMinuteRate * overtimeMinutes).toFixed(2));
      perItem[item.id] = { overtimeMinutes, overtimeCharge };
      totalOvertimeMinutes += overtimeMinutes;
      totalOvertimeCharge += overtimeCharge;
    }

    if (totalOvertimeCharge <= 0) return null;

    return {
      perItem,
      totalOvertimeMinutes,
      totalOvertimeCharge: Number(totalOvertimeCharge.toFixed(2)),
      projectedAt: now.toISOString(),
    };
  }

  /**
   * Writes projected live overtime into persisted item prices and booking subtotal, and advances
   * each affected item's end to `now` so `computeLiveOvertimeProjection` does not bill the same minutes twice.
   */
  private materializeLiveOvertimeOnBooking(
    booking: Booking,
    now: Date,
    courtToLocationMap: Record<string, string> = {},
    locationTimeZoneMap: Record<string, string> = {},
  ): void {
    if (booking.bookingStatus !== 'live') {
      throw new BadRequestException(
        'materializeLiveOvertime is only valid while the booking is live.',
      );
    }
    const projection = this.computeLiveOvertimeProjection(
      booking,
      now,
      courtToLocationMap,
      locationTimeZoneMap,
    );
    if (!projection || projection.totalOvertimeCharge <= 0) {
      throw new BadRequestException('There is no live overtime to add right now.');
    }
    let touched = false;
    for (const item of booking.items ?? []) {
      if (item.itemStatus === 'cancelled') continue;
      const o = projection.perItem[item.id];
      if (!o) continue;
      touched = true;
      item.price = dec(numFromDec(item.price) + o.overtimeCharge);
      item.endDatetime = now;
      item.endTime = now.toISOString().slice(11, 16);
      item.date = formatDateOnly(now);
    }
    if (!touched) {
      throw new BadRequestException('There is no live overtime to add right now.');
    }
    booking.subTotal = dec(
      numFromDec(booking.subTotal) + projection.totalOvertimeCharge,
    );
    booking.totalAmount = dec(
      this.computePayableAmount(
        numFromDec(booking.subTotal),
        numFromDec(booking.discount),
        numFromDec(booking.tax),
      ),
    );
    harmonizePaymentStatusWithAmounts(booking);
    this.applyBookingWindowFields(booking);
  }

  /** Stops further live overtime projection after totals are adjusted (see total-only `pricing` PATCH). */
  private advanceLiveBookingItemEndsThroughNow(
    booking: Booking,
    now: Date,
    courtToLocationMap: Record<string, string>,
    locationTimeZoneMap: Record<string, string>,
  ): void {
    if (booking.bookingStatus !== 'live') return;
    const bd = formatDateOnly(booking.bookingDate);
    for (const item of booking.items ?? []) {
      if (item.itemStatus === 'cancelled') continue;
      const ymd = formatDateOnly(item.date ?? booking.bookingDate);
      const locId = courtToLocationMap[item.courtId];
      const rawTz = locId ? locationTimeZoneMap[locId] : undefined;
      const endMs = rawTz?.trim()
        ? wallRangeToMs(ymd, item.startTime, item.endTime, rawTz).endMs
        : this.itemPlayEndMs(item, bd);
      if (now.getTime() <= endMs) continue;
      item.endDatetime = now;
      item.endTime = now.toISOString().slice(11, 16);
      item.date = formatDateOnly(now);
    }
  }

  private toApi(
    booking: Booking,
    locationsMap: Record<string, string> = {},
    courtToLocationMap: Record<string, string> = {},
    locationTimeZoneMap: Record<string, string> = {},
    courtNamesMap: Record<string, string> = {},
    opts?: { projectLiveViewStatus?: boolean; projectLiveOvertimePricing?: boolean },
  ): BookingApiRow {
    const timelineItems = this.sortBookingItemsForTimeline(booking);
    const first = timelineItems[0];
    const courtId = first?.courtId;
    const locationId = courtId ? courtToLocationMap[courtId] : undefined;
    const arenaId = locationId || booking.tenantId;
    const wall = this.computeBookingWindowWallTimes(booking);

    const projection =
      opts?.projectLiveOvertimePricing === true
        ? this.computeLiveOvertimeProjection(
            booking,
            new Date(),
            courtToLocationMap,
            locationTimeZoneMap,
          )
        : null;
    const extraOvertime = projection?.totalOvertimeCharge ?? 0;
    const baseSubTotal = numFromDec(booking.subTotal);
    const discountN = numFromDec(booking.discount);
    const taxN = numFromDec(booking.tax);
    const baseTotal = numFromDec(booking.totalAmount);
    const useOvertimePricing = Boolean(projection && extraOvertime > 0);
    const projectedSubTotal = useOvertimePricing
      ? Number((baseSubTotal + extraOvertime).toFixed(2))
      : baseSubTotal;
    const projectedTotal = useOvertimePricing
      ? this.computePayableAmount(projectedSubTotal, discountN, taxN)
      : baseTotal;

    let paymentStatusOut = booking.paymentStatus;
    if (useOvertimePricing) {
      const ph = {
        totalAmount: dec(projectedTotal),
        paidAmount: booking.paidAmount,
        paymentStatus: booking.paymentStatus,
      };
      harmonizePaymentStatusWithAmounts(ph);
      paymentStatusOut = ph.paymentStatus;
    }

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
      startTime: booking.startTime ?? wall?.startTime,
      endTime: booking.endTime ?? wall?.endTime,
      items: timelineItems.map((it) => {
        const o = projection?.perItem[it.id];
        const basePrice = numFromDec(it.price);
        const overtimeCharge = o ? o.overtimeCharge : 0;
        const overtimeMinutes = o ? o.overtimeMinutes : 0;
        const price = o
          ? Number((basePrice + overtimeCharge).toFixed(2))
          : basePrice;
        return {
          id: it.id,
          date: it.date,
          courtKind: it.courtKind,
          courtId: it.courtId,
          courtName: courtNamesMap[it.courtId],
          slotId: it.slotId,
          startTime: it.startTime,
          endTime: it.endTime,
          basePrice,
          overtimeCharge,
          overtimeMinutes,
          price,
          currency: it.currency,
          status: it.itemStatus,
        };
      }),
      pricing: {
        subTotal: useOvertimePricing ? projectedSubTotal : baseSubTotal,
        baseSubTotal,
        overtimeAmount: useOvertimePricing ? extraOvertime : 0,
        discount: discountN,
        tax: taxN,
        totalAmount: useOvertimePricing ? projectedTotal : baseTotal,
      },
      payment: {
        paymentStatus: paymentStatusOut,
        paymentMethod: booking.paymentMethod,
        transactionId: booking.transactionId,
        paidAt: booking.paidAt?.toISOString(),
        paidAmount: numFromDec(booking.paidAmount),
        remainingAmount: useOvertimePricing
          ? Math.max(
              0,
              Number((projectedTotal - numFromDec(booking.paidAmount)).toFixed(2)),
            )
          : numFromDec(booking.totalAmount) - numFromDec(booking.paidAmount),
      },
      bookingStatus:
        opts?.projectLiveViewStatus === false
          ? booking.bookingStatus
          : this.resolveBookingViewStatus(
              booking,
              locationId ? locationTimeZoneMap[locationId] : undefined,
            ),
      ...(useOvertimePricing && projection
        ? {
            liveOvertime: {
              projectedAt: projection.projectedAt,
              totalOvertimeMinutes: projection.totalOvertimeMinutes,
              totalOvertimeCharge: projection.totalOvertimeCharge,
            },
          }
        : {}),
      paymentTransactions: (booking.paymentTransactions ?? []).map((txn) => ({
        id: txn.id,
        method: txn.method,
        amount: Number(txn.amount),
        bankAccountId: txn.bankAccountId ?? undefined,
        transactionRef: txn.transactionRef ?? undefined,
        note: txn.note ?? undefined,
        paidAt: txn.paidAt?.toISOString?.() ?? txn.paidAt,
      })),
      notes: booking.notes,
      cancellationReason: booking.cancellationReason,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    };
  }

  private resolveBookingViewStatus(
    booking: Booking,
    locationTimeZone?: string,
  ): BookingViewStatus {
    void locationTimeZone;
    return booking.bookingStatus;
  }

  async list(requesterUserId: string, tenantId?: string, locationId?: string): Promise<BookingApiRow[]> {
    const isPlatformOwner = await this.iamService.hasAnyRole(requesterUserId, ['platform-owner']);
    const constraint = await this.iamService.getLocationAdminConstraint(requesterUserId);
    
    const qb = this.bookingRepo.createQueryBuilder('b')
      .leftJoinAndSelect('b.items', 'items')
      .leftJoinAndSelect('b.user', 'user');

    if (tenantId) {
      qb.andWhere('b.tenantId = :tenantId', { tenantId });
    } else if (!isPlatformOwner) {
      throw new UnauthorizedException('Tenant ID is required');
    }

    const effectiveLocationId = constraint || locationId;

    if (effectiveLocationId) {
      const padels = await this.padelRepo.find({
        where: { businessLocationId: effectiveLocationId },
        select: ['id'],
      });
      const turfs = await this.turfRepo.find({
        where: { branchId: effectiveLocationId },
        select: ['id'],
      });
      const tableTennisCourts = await this.tableTennisRepo.find({
        where: { businessLocationId: effectiveLocationId },
        select: ['id'],
      });
      const courtIds = [
        ...padels.map((p) => p.id),
        ...turfs.map((t) => t.id),
        ...tableTennisCourts.map((t) => t.id),
      ];
      if (courtIds.length === 0) return [];
      
      qb.andWhere((sub) => {
        const subQuery = sub.subQuery()
          .select('i.bookingId')
          .from(BookingItem, 'i')
          .where('i.courtId IN (:...courtIds)', { courtIds })
          .getQuery();
        return 'b.id IN ' + subQuery;
      });
    }

    qb.orderBy('b.createdAt', 'DESC');
    const rows = await qb.getMany();

    const { locationsMap, courtToLocationMap, locationTimeZoneMap, courtNamesMap } =
      await this.resolveLocationMappingBatch(rows);

    return rows.map((b) =>
      this.toApi(b, locationsMap, courtToLocationMap, locationTimeZoneMap, courtNamesMap),
    );
  }

  async listByUserForProfile(userId: string): Promise<BookingApiRow[]> {
    const rows = await this.bookingRepo.find({
      where: { userId },
      relations: ['items', 'user', 'paymentTransactions'],
      order: { createdAt: 'DESC' },
    });

    const { locationsMap, courtToLocationMap, locationTimeZoneMap, courtNamesMap } =
      await this.resolveLocationMappingBatch(rows);

    return rows.map((b) =>
      this.toApi(b, locationsMap, courtToLocationMap, locationTimeZoneMap, courtNamesMap),
    );
  }

  async getOne(tenantId: string, bookingId: string, requesterUserId?: string): Promise<BookingApiRow> {
    const row = await this.bookingRepo.findOne({
      where: { id: bookingId, tenantId },
      relations: ['items', 'user', 'paymentTransactions'],
    });
    if (!row) throw new NotFoundException(`Booking ${bookingId} not found`);

    if (requesterUserId) {
      const constraint = await this.iamService.getLocationAdminConstraint(requesterUserId);
      if (constraint) {
        const padels = await this.padelRepo.find({ where: { businessLocationId: constraint }, select: ['id'] });
        const turfs = await this.turfRepo.find({ where: { branchId: constraint }, select: ['id'] });
        const tableTennisCourts = await this.tableTennisRepo.find({
          where: { businessLocationId: constraint },
          select: ['id'],
        });
        const courtIds = new Set([
          ...padels.map((p) => p.id),
          ...turfs.map((t) => t.id),
          ...tableTennisCourts.map((t) => t.id),
        ]);
        const allowed = row.items?.some((i) => courtIds.has(i.courtId));
        if (!allowed) throw new ForbiddenException('Booking does not belong to your location');
      }
    }

    const { locationsMap, courtToLocationMap, locationTimeZoneMap, courtNamesMap } =
      await this.resolveLocationMapping(row);

    return this.toApi(row, locationsMap, courtToLocationMap, locationTimeZoneMap, courtNamesMap, {
      projectLiveOvertimePricing: true,
    });
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

  private async assertTableTennisCourtExists(
    tenantId: string,
    courtId: string,
  ): Promise<TableTennisCourt> {
    const court = await this.tableTennisRepo.findOne({
      where: { id: courtId, tenantId },
    });
    if (!court)
      throw new BadRequestException(
        `Table tennis table ${courtId} not found for this tenant`,
      );
    if (court.courtStatus !== 'active' || court.isActive === false) {
      throw new BadRequestException('Selected table is not available');
    }
    return court;
  }

  private inferStepMinutesFromSlots(
    slots: Array<{ startTime: string }>,
  ): number | null {
    const minutes = slots
      .map((s) => toMinutes(s.startTime, false))
      .sort((a, b) => a - b);
    let minDiff: number | null = null;
    for (let i = 1; i < minutes.length; i += 1) {
      const diff = minutes[i] - minutes[i - 1];
      if (diff > 0 && (minDiff === null || diff < minDiff)) {
        minDiff = diff;
      }
    }
    return minDiff;
  }

  private async resolveCourtSlotStepMinutes(
    tenantId: string,
    kind: CourtKind,
    courtId: string,
  ): Promise<number> {
    if (kind === 'padel_court') {
      const row = await this.padelRepo.findOne({
        where: { tenantId, id: courtId },
        select: ['slotDurationMinutes'],
      });
      if (row?.slotDurationMinutes && row.slotDurationMinutes > 0) {
        return row.slotDurationMinutes;
      }
    } else if (kind === 'table_tennis_court') {
      const row = await this.tableTennisRepo.findOne({
        where: { tenantId, id: courtId },
        select: ['slotDurationMinutes'],
      });
      if (row?.slotDurationMinutes && row.slotDurationMinutes > 0) {
        return row.slotDurationMinutes;
      }
    } else if (kind === 'turf_court') {
      const row = await this.turfRepo.findOne({
        where: { tenantId, id: courtId },
        select: ['slotDuration'],
      });
      if (row?.slotDuration && row.slotDuration > 0) {
        return row.slotDuration;
      }
    }
    return BookingsService.DEFAULT_SLOT_STEP_MINUTES;
  }

  private bookingItemEffectiveEndTime(
    item: {
      startTime: string;
      endTime: string;
      startDatetime?: Date | string | null;
      endDatetime?: Date | string | null;
    },
    slotStepMinutes = BookingsService.DEFAULT_SLOT_STEP_MINUTES,
  ): string {
    return resolveBookingMatchEndTime(
      item,
      slotStepMinutes,
      BookingsService.SLOT_OVERLAP_GRACE_MINUTES,
    );
  }

  private itemDatetimeWallEnd(
    date: string,
    item: { startTime: string; endTime: string },
    slotStepMinutes = BookingsService.DEFAULT_SLOT_STEP_MINUTES,
  ): string {
    return this.bookingItemEffectiveEndTime(
      { startTime: item.startTime, endTime: item.endTime },
      slotStepMinutes,
    );
  }

  private toSlotDateTimes(
    bookingDate: string,
    startTime: string,
    endTime: string,
  ) {
    const date = formatDateOnly(bookingDate);
    const startMin = toMinutes(startTime, false);
    const endMin = toMinutes(endTime, true);
    const overnight = endMin <= startMin;
    const spansNextCalendarDay = overnight || endMin >= 24 * 60;
    const endDate = spansNextCalendarDay ? addDays(date, 1) : date;
    const endPart =
      endTime === '24:00' || (endMin >= 24 * 60 && !overnight) ? '00:00' : endTime;
    return {
      startDatetime: new Date(`${date}T${startTime}:00Z`),
      endDatetime: new Date(`${endDate}T${endPart}:00Z`),
    };
  }

  private itemFacilitySlotSyncWindows(
    item: Pick<
      BookingItem,
      'date' | 'startTime' | 'endTime' | 'startDatetime' | 'endDatetime'
    >,
    bookingDate: string,
    slotStepMinutes = BookingsService.DEFAULT_SLOT_STEP_MINUTES,
  ): Array<{ slotDate: string; windowStart: string; windowEnd: string }> {
    const wallEnd = facilitySlotMarkingWallEnd(
      item,
      slotStepMinutes,
      BookingsService.SLOT_OVERLAP_GRACE_MINUTES,
    );
    return buildItemFacilitySlotSyncWindows(
      {
        date: item.date ?? bookingDate,
        startTime: item.startTime,
        endTime: wallEnd,
        startDatetime: item.startDatetime,
        endDatetime: item.endDatetime,
        useMarkingWallEnd: true,
      },
      bookingDate,
      slotStepMinutes,
    );
  }

  private async updateFacilitySlotsInWindow(params: {
    tenantId: string;
    courtKind: CourtKind;
    courtId: string;
    slotDate: string;
    windowStart: string;
    windowEnd: string;
    targetStatus: CourtFacilitySlotStatus;
  }): Promise<{ affected: number; touchedStarts: string[] }> {
    const slotStepMinutes = await this.resolveCourtSlotStepMinutes(
      params.tenantId,
      params.courtKind,
      params.courtId,
    );
    const slots = await this.facilitySlotRepo.find({
      where: {
        tenantId: params.tenantId,
        courtKind: params.courtKind,
        courtId: params.courtId,
        slotDate: params.slotDate,
      },
      select: ['startTime', 'endTime'],
    });
    let affected = 0;
    const touchedStarts: string[] = [];
    for (const slot of slots) {
      const inWindow =
        params.targetStatus === 'booked' || params.targetStatus === 'blocked'
          ? facilitySlotStartInMarkWindow(
              slot.startTime,
              params.windowStart,
              params.windowEnd,
            )
          : facilitySlotOverlapsWallWindow(
              slot.startTime,
              slot.endTime,
              params.windowStart,
              params.windowEnd,
              slotStepMinutes,
            );
      if (!inWindow) {
        continue;
      }
      await this.facilitySlotRepo.update(
        {
          tenantId: params.tenantId,
          courtKind: params.courtKind,
          courtId: params.courtId,
          slotDate: params.slotDate,
          startTime: slot.startTime,
        },
        { status: params.targetStatus },
      );
      if (
        params.targetStatus === 'booked' ||
        params.targetStatus === 'blocked'
      ) {
        this.logFacilitySlotStatusChange(params.targetStatus, {
          tenantId: params.tenantId,
          courtKind: params.courtKind,
          courtId: params.courtId,
          slotDate: params.slotDate,
          startTime: slot.startTime,
          endTime: slot.endTime,
          windowStart: params.windowStart,
          windowEnd: params.windowEnd,
        });
      }
      affected += 1;
      touchedStarts.push(slot.startTime);
    }
    return { affected, touchedStarts };
  }

  private logFacilitySlotStatusChange(
    status: 'booked' | 'blocked',
    params: {
      tenantId: string;
      courtKind: CourtKind;
      courtId: string;
      slotDate: string;
      startTime: string;
      endTime: string;
      windowStart?: string;
      windowEnd?: string;
      slotId?: string;
    },
  ): void {
    bookingProcessStep(this.logger, 'facility-slot.status', {
      status,
      tenantId: params.tenantId,
      courtKind: params.courtKind,
      courtId: params.courtId,
      slotDate: params.slotDate,
      startTime: params.startTime,
      endTime: params.endTime,
      windowStart: params.windowStart,
      windowEnd: params.windowEnd,
      slotId: params.slotId,
    });
  }

  /** Clear stale booking-driven blocks; availability is enforced via booking_items. */
  private async reconcileFacilitySlotsForCourtDate(
    tenantId: string,
    courtKind: CourtKind,
    courtId: string,
    slotDate: string,
  ): Promise<void> {
    const slots = await this.facilitySlotRepo.find({
      where: { tenantId, courtKind, courtId, slotDate },
      select: ['startTime', 'endTime', 'status'],
    });
    if (!slots.length) return;

    const slotStepMinutes = await this.resolveCourtSlotStepMinutes(
      tenantId,
      courtKind,
      courtId,
    );

    const dayStart = new Date(`${slotDate}T00:00:00.000Z`);
    const dayEnd = new Date(`${addDays(slotDate, 1)}T00:00:00.000Z`);
    const activeRows = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.items', 'i')
      .where('b.tenantId = :tenantId', { tenantId })
      .andWhere("b.bookingStatus IN ('pending', 'confirmed', 'live')")
      .andWhere("i.itemStatus <> 'cancelled'")
      .andWhere('i.courtKind = :courtKind', { courtKind })
      .andWhere('i.courtId = :courtId', { courtId })
      .andWhere('i.startDatetime < :dayEnd', { dayEnd: dayEnd.toISOString() })
      .andWhere('i.endDatetime > :dayStart', {
        dayStart: dayStart.toISOString(),
      })
      .select([
        'b.bookingDate AS bookingDate',
        'i.date AS itemDate',
        'i.startTime AS startTime',
        'i.endTime AS endTime',
        'i.startDatetime AS startDatetime',
        'i.endDatetime AS endDatetime',
      ])
      .getRawMany<{
        bookingDate: string;
        itemDate: string | null;
        startTime: string;
        endTime: string;
        startDatetime: string;
        endDatetime: string;
      }>();

    const availableStarts: string[] = [];

    for (const slot of slots) {
      let hasActiveBooking = false;
      for (const item of activeRows) {
        if (
          bookingItemCoversFacilitySlotOnGridDate(
            slotDate,
            slot.startTime,
            slot.endTime,
            item,
            slotStepMinutes,
          )
        ) {
          hasActiveBooking = true;
          break;
        }
      }

      if (!hasActiveBooking && slot.status === 'booked') {
        availableStarts.push(slot.startTime);
      }
    }

    if (availableStarts.length) {
      await this.facilitySlotRepo
        .createQueryBuilder()
        .update(CourtFacilitySlot)
        .set({ status: 'available' })
        .where('tenantId = :tenantId', { tenantId })
        .andWhere('courtKind = :courtKind', { courtKind })
        .andWhere('courtId = :courtId', { courtId })
        .andWhere('slotDate = :slotDate', { slotDate })
        .andWhere("status = 'booked'")
        .andWhere('startTime IN (:...availableStarts)', { availableStarts })
        .execute();
    }
  }

  private async reconcileFacilitySlotsForBookingItems(
    tenantId: string,
    items: Array<
      Pick<BookingItem, 'courtKind' | 'courtId' | 'date' | 'itemStatus'> & {
        startTime?: string;
        endTime?: string;
        startDatetime?: Date | string | null;
        endDatetime?: Date | string | null;
      }
    >,
    bookingDate: string,
  ): Promise<void> {
    const touched = new Set<string>();
    for (const item of items) {
      if (item.itemStatus === 'cancelled') continue;
      const bd = formatDateOnly(item.date ?? bookingDate);
      const windows = this.itemFacilitySlotSyncWindows(
        {
          date: item.date ?? bd,
          startTime: item.startTime ?? '00:00',
          endTime: item.endTime ?? '01:00',
        },
        bd,
      );
      for (const { slotDate } of windows) {
        touched.add(`${item.courtKind}\t${item.courtId}\t${slotDate}`);
      }
    }
    for (const key of touched) {
      const [courtKind, courtId, slotDate] = key.split('\t') as [
        CourtKind,
        string,
        string,
      ];
      await this.reconcileFacilitySlotsForCourtDate(
        tenantId,
        courtKind,
        courtId,
        slotDate,
      );
    }
  }

  private isOverlapBeyondGrace(
    existingStart: Date,
    existingEnd: Date,
    requestedStart: Date,
    requestedEnd: Date,
  ): boolean {
    const overlapStartMs = Math.max(
      existingStart.getTime(),
      requestedStart.getTime(),
    );
    const overlapEndMs = Math.min(existingEnd.getTime(), requestedEnd.getTime());
    if (overlapEndMs <= overlapStartMs) return false;

    const overlapMinutes = (overlapEndMs - overlapStartMs) / 60000;
    if (overlapMinutes > BookingsService.SLOT_OVERLAP_GRACE_MINUTES) {
      return true;
    }

    const touchesRequestedStart =
      existingStart.getTime() < requestedStart.getTime() &&
      existingEnd.getTime() > requestedStart.getTime();
    const touchesRequestedEnd =
      existingStart.getTime() < requestedEnd.getTime() &&
      existingEnd.getTime() > requestedEnd.getTime();
    return !(touchesRequestedStart || touchesRequestedEnd);
  }

  /** Same-night chronological order before expanding/splitting (aligns with web app overnight sorting). */
  private sortInboundBookingItemsForCreate(
    bookingDate: string | undefined,
    items: CreateBookingItemDto[],
  ): CreateBookingItemDto[] {
    if (!items.length) return [...items];

    const baseFallback = bookingDate ? formatDateOnly(bookingDate) : '';
    type Row = {
      item: CreateBookingItemDto;
      dateKey: string;
      rawStart: number;
      sortKey: number;
      idx: number;
    };

    const rows: Row[] = items.map((item, idx) => {
      const dk =
        formatDateOnly(item.date ?? item.bookingDate ?? baseFallback ?? '') ||
        '__nodate__';
      const rawStart = toMinutes(item.startTime, false);
      return {
        item,
        dateKey: dk,
        rawStart,
        sortKey: rawStart,
        idx,
      };
    });

    const byDate = new Map<string, Row[]>();
    for (const row of rows) {
      const bucket = byDate.get(row.dateKey);
      if (bucket) bucket.push(row);
      else byDate.set(row.dateKey, [row]);
    }

    for (const group of byDate.values()) {
      if (group.length < 2) continue;
      const mins = group.map((g) => g.rawStart);
      const minS = Math.min(...mins);
      const maxS = Math.max(...mins);
      if (maxS - minS <= 12 * 60) continue;
      for (const g of group) {
        if (g.rawStart < 6 * 60) g.sortKey = g.rawStart + 24 * 60;
      }
    }

    rows.sort((a, b) => {
      if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      const endDiff = toMinutes(a.item.endTime, true) - toMinutes(b.item.endTime, true);
      if (endDiff !== 0) return endDiff;
      if (a.item.courtKind !== b.item.courtKind) {
        return a.item.courtKind.localeCompare(b.item.courtKind);
      }
      return a.item.courtId.localeCompare(b.item.courtId) || a.idx - b.idx;
    });

    return rows.map((r) => r.item);
  }

  private resolveItemBookingDates(
    bookingDate: string,
    items: CreateBookingItemDto[],
  ): string[] {
    const baseDate = formatDateOnly(bookingDate);
    const dayOffsetByCourt = new Map<string, number>();
    const prevEffectiveByCourt = new Map<string, number>();

    const startsByCourt = new Map<string, number[]>();
    for (const item of items) {
      const key = `${item.courtKind}:${item.courtId}`;
      const raw = toMinutes(item.startTime, false);
      const list = startsByCourt.get(key);
      if (list) list.push(raw);
      else startsByCourt.set(key, [raw]);
    }

    const toEffectiveStart = (courtKey: string, rawStart: number): number => {
      const list = startsByCourt.get(courtKey) ?? [rawStart];
      if (list.length < 2) return rawStart;
      const minS = Math.min(...list);
      const maxS = Math.max(...list);
      if (maxS - minS > 12 * 60 && rawStart < 6 * 60) {
        return rawStart + 24 * 60;
      }
      return rawStart;
    };

    return items.map((item) => {
      const key = `${item.courtKind}:${item.courtId}`;
      const raw = toMinutes(item.startTime, false);
      const effective = toEffectiveStart(key, raw);
      const prevEffective = prevEffectiveByCourt.get(key);
      let offset = dayOffsetByCourt.get(key) ?? 0;

      // Effective timeline went backwards ⇒ next calendar day for this court.
      if (prevEffective !== undefined && effective < prevEffective) {
        offset += 1;
        dayOffsetByCourt.set(key, offset);
      } else if (!dayOffsetByCourt.has(key)) {
        dayOffsetByCourt.set(key, offset);
      }

      prevEffectiveByCourt.set(key, effective);
      return addDays(baseDate, offset);
    });
  }

  private expandBookingItems(
    bookingDate: string | undefined,
    items: CreateBookingItemDto[],
  ): Array<CreateBookingItemDto & { date: string }> {
    const derivedDates = bookingDate
      ? this.resolveItemBookingDates(bookingDate, items)
      : [];
    const expanded: Array<CreateBookingItemDto & { date: string }> = [];

    for (const [idx, item] of items.entries()) {
      const fallbackDate = derivedDates[idx];
      const resolvedDate = item.date ?? fallbackDate;
      if (!resolvedDate) {
        throw new BadRequestException(
          'bookingDate is required at root or per item (items[].date/items[].bookingDate)',
        );
      }
      const itemDate = formatDateOnly(resolvedDate);
      const isOvernight = toMinutes(item.endTime, true) <= toMinutes(item.startTime, false);

      if (!isOvernight) {
        expanded.push({ ...item, date: itemDate });
        continue;
      }

      const firstEnd = '24:00';
      const secondDate = addDays(itemDate, 1);
      const secondStart = '00:00';
      const totalMinutes = diffMinutes(item.startTime, item.endTime);
      const firstMinutes = diffMinutes(item.startTime, firstEnd);
      const secondMinutes = diffMinutes(secondStart, item.endTime);
      const firstPrice = Number(((item.price * firstMinutes) / totalMinutes).toFixed(2));
      const secondPrice = Number((item.price - firstPrice).toFixed(2));

      expanded.push({
        ...item,
        date: itemDate,
        endTime: firstEnd,
        price: firstPrice,
      });
      expanded.push({
        ...item,
        date: secondDate,
        startTime: secondStart,
        price: secondPrice,
      });
    }

    return expanded;
  }

  private applyImmediateStartShift(
    items: Array<CreateBookingItemDto & { date: string }>,
  ): Array<CreateBookingItemDto & { date: string }> {
    const today = getCurrentDateInKarachi();
    const nowMinutes = getCurrentMinutesInKarachi();

    return items.map((item) => {
      if (formatDateOnly(item.date) !== today) return item;

      const startMinutes = toMinutes(item.startTime, false);
      const endMinutes = toMinutes(item.endTime, true);
      if (nowMinutes <= startMinutes || nowMinutes >= endMinutes) {
        return item;
      }

      const durationMinutes = diffMinutes(item.startTime, item.endTime);
      const shiftedStart = new Date(`${item.date}T00:00:00Z`);
      shiftedStart.setUTCMinutes(nowMinutes);
      const shiftedEnd = new Date(
        shiftedStart.getTime() + durationMinutes * 60 * 1000,
      );

      return {
        ...item,
        date: formatDateOnly(shiftedStart),
        startTime: shiftedStart.toISOString().slice(11, 16),
        endTime: shiftedEnd.toISOString().slice(11, 16),
      };
    });
  }

  private assertBookingItem(item: CreateBookingItemDto): void {
    if (
      item.courtKind !== 'padel_court' &&
      item.courtKind !== 'turf_court' &&
      item.courtKind !== 'table_tennis_court'
    ) {
      throw new BadRequestException(
        'Only padel_court, turf_court, and table_tennis_court are supported',
      );
    }
    if (item.startTime === '24:00') {
      throw new BadRequestException('startTime cannot be 24:00');
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
    const slotStep = await this.resolveCourtSlotStepMinutes(
      tenantId,
      item.courtKind,
      item.courtId,
    );
    const effectiveEnd = this.bookingItemEffectiveEndTime(item, slotStep);
    const { startDatetime, endDatetime } = this.toSlotDateTimes(
      date,
      item.startTime,
      effectiveEnd,
    );

    const overlaps = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.items', 'i')
      .where('i.courtKind = :kind', { kind: item.courtKind })
      .andWhere('i.courtId = :courtId', { courtId: item.courtId })
      .andWhere("i.itemStatus <> 'cancelled'")
      // Ignore terminal bookings that should not block new reservations.
      .andWhere("b.bookingStatus NOT IN ('cancelled', 'no_show', 'completed')")
      .andWhere('i.startDatetime < :endDatetime', {
        endDatetime: endDatetime.toISOString(),
      })
      .andWhere('i.endDatetime > :startDatetime', {
        startDatetime: startDatetime.toISOString(),
      })
      .select(['i.startDatetime AS startDatetime', 'i.endDatetime AS endDatetime'])
      .getRawMany<{ startDatetime: string; endDatetime: string }>();

    const hasHardOverlap = overlaps.some((row) =>
      this.isOverlapBeyondGrace(
        new Date(row.startDatetime),
        new Date(row.endDatetime),
        startDatetime,
        endDatetime,
      ),
    );

    if (hasHardOverlap)
      throw new ConflictException({
        bookingDate: date,
        startTime: item.startTime,
        endTime: item.endTime,
        courtId: item.courtId,
        reason: 'Selected slot is already booked',
      });
  }

  private async assertNoOtherLiveBookingOnFields(
    tenantId: string,
    items: Array<{
      courtKind: CreateBookingItemDto['courtKind'];
      courtId: string;
      itemStatus?: BookingItemStatus;
    }>,
    excludeBookingId?: string,
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const uniqueFields = new Map<string, { courtKind: string; courtId: string }>();
    for (const item of items) {
      if (item.itemStatus === 'cancelled') continue;
      const key = `${item.courtKind}:${item.courtId}`;
      if (!uniqueFields.has(key)) {
        uniqueFields.set(key, {
          courtKind: item.courtKind,
          courtId: item.courtId,
        });
      }
    }

    for (const field of uniqueFields.values()) {
      const qb = this.bookingRepo
        .createQueryBuilder('b')
        .innerJoin('b.items', 'i')
        .where('b.tenantId = :tenantId', { tenantId })
        .andWhere("b.bookingStatus = 'live'")
        .andWhere("i.itemStatus <> 'cancelled'")
        // Guard against stale "live" rows: only block if currently live in time.
        .andWhere('i.startDatetime <= :nowIso', { nowIso })
        .andWhere('i.endDatetime > :nowIso', { nowIso })
        .andWhere('i.courtKind = :courtKind', { courtKind: field.courtKind })
        .andWhere('i.courtId = :courtId', { courtId: field.courtId });
      if (excludeBookingId) {
        qb.andWhere('b.id <> :excludeBookingId', { excludeBookingId });
      }
      const liveCount = await qb.getCount();
      if (liveCount > 0) {
        throw new ConflictException(
          'Field is already live. End the current live booking before starting another one.',
        );
      }
    }
  }

  async create(
    tenantId: string,
    dto: CreateBookingDto,
  ): Promise<BookingApiRow> {
    const createStarted = Date.now();
    bookingProcessStep(this.logger, 'api.create.request', {
      tenantId,
      sportType: dto.sportType,
      bookingDate: dto.bookingDate,
      bookingStatus: dto.bookingStatus,
      itemCount: dto.items?.length ?? 0,
      items: summarizeCreateItems(
        (dto.items ?? []).map((i) => ({
          courtKind: i.courtKind,
          courtId: i.courtId,
          date: i.date,
          startTime: i.startTime,
          endTime: i.endTime,
        })),
      ),
      notes: dto.notes,
    });

    if (dto.bookingDate) {
      this.assertBookingDateInAllowedWindow(dto.bookingDate);
    }

    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw new BadRequestException(`User ${dto.userId} not found`);

    if (dto.items?.length) {
      dto.items = this.sortInboundBookingItemsForCreate(dto.bookingDate, dto.items);
    }

    let expandedItems = this.expandBookingItems(
      dto.bookingDate,
      dto.items,
    );
    expandedItems = this.applyImmediateStartShift(expandedItems);
    for (const item of expandedItems) {
      this.assertBookingDateInAllowedWindow(item.date);
    }

    for (const item of expandedItems) {
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
      if (item.courtKind === 'table_tennis_court') {
        await this.assertTableTennisCourtExists(tenantId, item.courtId);
        if (dto.sportType !== 'table-tennis') {
          throw new BadRequestException(
            'table_tennis_court requires sportType=table-tennis',
          );
        }
      }
      await this.assertNoOverlap(tenantId, item.date, item);
    }

    const itemsPayload: DeepPartial<BookingItem>[] = [];
    for (const i of expandedItems) {
      const slotStep = await this.resolveCourtSlotStepMinutes(
        tenantId,
        i.courtKind,
        i.courtId,
      );
      const wallEnd = this.itemDatetimeWallEnd(i.date, i, slotStep);
      itemsPayload.push({
        courtKind: i.courtKind,
        courtId: i.courtId,
        slotId: i.slotId,
        date: i.date,
        startTime: i.startTime,
        endTime: wallEnd,
        ...this.toSlotDateTimes(i.date, i.startTime, wallEnd),
        price: dec(i.price),
        currency: i.currency ?? 'PKR',
        itemStatus: i.status ?? 'confirmed',
      });
    }
    itemsPayload.sort(
      (a, b) =>
        ((a.startDatetime as Date)?.getTime() ?? 0) -
        ((b.startDatetime as Date)?.getTime() ?? 0),
    );

    const pricingSubTotal = Number(dto.pricing.subTotal ?? 0);
    const pricingDiscount = Number(dto.pricing.discount ?? 0);
    const pricingTax = Number(dto.pricing.tax ?? 0);
    const payableAmount = this.computePayableAmount(
      pricingSubTotal,
      pricingDiscount,
      pricingTax,
    );
    const paidAmount = Number(dto.payment.paidAmount ?? 0);
    this.assertPaidAmountWithinPayable(paidAmount, payableAmount);

    const bookingPayload: DeepPartial<Booking> = {
      tenantId,
      userId: dto.userId,
      sportType: dto.sportType,
      bookingDate: formatDateOnly(dto.bookingDate ?? expandedItems[0].date),
      subTotal: dec(pricingSubTotal),
      discount: dec(pricingDiscount),
      tax: dec(pricingTax),
      totalAmount: dec(payableAmount),
      paymentStatus: dto.payment.paymentStatus,
      paymentMethod: dto.payment.paymentMethod,
      transactionId: dto.payment.transactionId,
      paidAt: dto.payment.paidAt ? new Date(dto.payment.paidAt) : undefined,
      paidAmount: dec(paidAmount),
      bookingStatus: dto.bookingStatus ?? 'confirmed',
      notes: dto.notes,
      items: itemsPayload,
    };
    harmonizePaymentStatusWithAmounts(
      bookingPayload as Pick<Booking, 'totalAmount' | 'paidAmount' | 'paymentStatus'>,
    );
    const booking = this.bookingRepo.create(bookingPayload);
    this.applyBookingWindowFields(booking);

    let saved: Booking;
    try {
      saved = await this.bookingRepo.save(booking);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).driverError?.code === '23505' &&
        String((error as any).driverError?.constraint || '').includes(
          'uq_booking_items_court_start_datetime_active',
        )
      ) {
        bookingProcessWarn(this.logger, 'api.create.conflict', {
          tenantId,
          bookingDate: booking.bookingDate,
          items: summarizeCreateItems(
            (booking.items ?? []).map((i) => ({
              courtKind: i.courtKind,
              courtId: i.courtId,
              date: i.date,
              startTime: i.startTime,
              endTime: i.endTime,
              startDatetime: i.startDatetime as Date | undefined,
              endDatetime: i.endDatetime as Date | undefined,
            })),
          ),
        });
        throw new ConflictException({
          reason:
            'Selected slot overlaps with an active booking. Please choose another time.',
        });
      }
      bookingProcessError(this.logger, 'api.create.failed', error, {
        tenantId,
        ms: Date.now() - createStarted,
      });
      throw error;
    }

    const full = await this.bookingRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ['items', 'user', 'paymentTransactions'],
    });

    if (full.bookingStatus === 'confirmed' || full.bookingStatus === 'pending') {
      await this.markFacilitySlotsBookedForBooking(full);
    }

    const { locationsMap, courtToLocationMap, locationTimeZoneMap, courtNamesMap } =
      await this.resolveLocationMapping(full);
    const row = this.toApi(full, locationsMap, courtToLocationMap, locationTimeZoneMap, courtNamesMap);
    this.notifyBookingChange(tenantId, full.id, 'created');

    const firstItem = full.items?.[0];
    let postGridSummary: Record<string, unknown> | undefined;
    if (firstItem) {
      try {
        const post = await this.getCourtSlots(tenantId, {
          kind: firstItem.courtKind,
          courtId: firstItem.courtId,
          date: formatDateOnly(firstItem.date ?? full.bookingDate),
          skipCourtCheck: true,
          quietLog: true,
        });
        postGridSummary = summarizeSlotAvailability(post.slots);
      } catch {
        postGridSummary = { error: 'post-create grid check failed' };
      }
    }

    bookingProcessStep(this.logger, 'api.create.success', {
      tenantId,
      bookingId: full.id,
      ms: Date.now() - createStarted,
      bookingStatus: full.bookingStatus,
      items: summarizeCreateItems(
        (full.items ?? []).map((i) => ({
          courtKind: i.courtKind,
          courtId: i.courtId,
          date: i.date,
          startTime: i.startTime,
          endTime: i.endTime,
          startDatetime: i.startDatetime,
          endDatetime: i.endDatetime,
        })),
      ),
      postGrid: postGridSummary,
    });

    return row;
  }

  async update(
    tenantId: string,
    bookingId: string,
    dto: UpdateBookingDto,
  ): Promise<BookingApiRow> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId, tenantId },
      relations: ['items', 'user', 'paymentTransactions'],
    });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);

    let preLiveFacilityItems: BookingItem[] | undefined;

    if (dto.materializeLiveOvertime === true) {
      const { courtToLocationMap, locationTimeZoneMap } =
        await this.resolveLocationMapping(booking);
      this.materializeLiveOvertimeOnBooking(
        booking,
        new Date(),
        courtToLocationMap,
        locationTimeZoneMap,
      );
    } else if (
      dto.payment?.paidAmount !== undefined &&
      booking.bookingStatus === 'live'
    ) {
      const requestedPaid = Number(dto.payment.paidAmount);
      if (
        Number.isFinite(requestedPaid) &&
        requestedPaid > numFromDec(booking.totalAmount) + 0.005
      ) {
        const { courtToLocationMap, locationTimeZoneMap } =
          await this.resolveLocationMapping(booking);
        const projection = this.computeLiveOvertimeProjection(
          booking,
          new Date(),
          courtToLocationMap,
          locationTimeZoneMap,
        );
        if (projection && projection.totalOvertimeCharge > 0) {
          this.materializeLiveOvertimeOnBooking(
            booking,
            new Date(),
            courtToLocationMap,
            locationTimeZoneMap,
          );
        }
      }
    }

    if (dto.bookingStatus !== undefined) {
      const requestedStatus = dto.bookingStatus;
      if (requestedStatus === 'live') {
        if (booking.bookingStatus === 'live') {
          throw new ConflictException('Booking is already live.');
        }
        preLiveFacilityItems = booking.items
          .filter((item) => item.itemStatus !== 'cancelled')
          .map((item) => {
            const fallbackDate = formatDateOnly(item.date ?? booking.bookingDate);
            const itemWindow = this.toSlotDateTimes(
              fallbackDate,
              item.startTime,
              item.endTime,
            );
            return Object.assign(new BookingItem(), {
              courtKind: item.courtKind,
              courtId: item.courtId,
              date: fallbackDate,
              startTime: item.startTime,
              endTime: item.endTime,
              startDatetime: item.startDatetime ?? itemWindow.startDatetime,
              endDatetime: item.endDatetime ?? itemWindow.endDatetime,
            });
          });

        await this.assertNoOtherLiveBookingOnFields(
          tenantId,
          booking.items.map((item) => ({
            courtKind: item.courtKind,
            courtId: item.courtId,
            itemStatus: item.itemStatus,
          })),
          booking.id,
        );
        this.applyLiveWindowToBooking(booking);
      } else {
        booking.bookingStatus = requestedStatus;
      }
      // Align every item in memory: subsequent save() cascades to booking_items, and
      // a raw SQL UPDATE would be overwritten by those stale in-memory item rows.
      let targetItemStatus: BookingItemStatus = 'confirmed';
      if (requestedStatus === 'cancelled' || requestedStatus === 'no_show') {
        targetItemStatus = 'cancelled';
      } else if (requestedStatus === 'pending') {
        targetItemStatus = 'reserved';
      }
      for (const item of booking.items) {
        item.itemStatus = targetItemStatus;
      }
    }
    if (dto.notes !== undefined) booking.notes = dto.notes;
    if (dto.cancellationReason !== undefined)
      booking.cancellationReason = dto.cancellationReason;
    if (dto.pricing) {
      const hasPart =
        dto.pricing.subTotal !== undefined ||
        dto.pricing.discount !== undefined ||
        dto.pricing.tax !== undefined;
      const totalOnly =
        dto.pricing.totalAmount !== undefined && !hasPart;

      if (totalOnly) {
        const t = Number(dto.pricing.totalAmount);
        if (!Number.isFinite(t) || t < 0) {
          throw new BadRequestException('pricing.totalAmount must be a non-negative number.');
        }
        const prevTotal = numFromDec(booking.totalAmount);
        booking.totalAmount = dec(t);
        booking.subTotal = dec(
          numFromDec(booking.totalAmount) +
            numFromDec(booking.discount) -
            numFromDec(booking.tax),
        );
        if (
          booking.bookingStatus === 'live' &&
          t > prevTotal + 0.005
        ) {
          const { courtToLocationMap, locationTimeZoneMap } =
            await this.resolveLocationMapping(booking);
          this.advanceLiveBookingItemEndsThroughNow(
            booking,
            new Date(),
            courtToLocationMap,
            locationTimeZoneMap,
          );
        }
      } else {
        if (dto.pricing.subTotal !== undefined) {
          booking.subTotal = dec(dto.pricing.subTotal);
        }
        if (dto.pricing.discount !== undefined) {
          booking.discount = dec(dto.pricing.discount);
        }
        if (dto.pricing.tax !== undefined) {
          booking.tax = dec(dto.pricing.tax);
        }
        booking.totalAmount = dec(
          this.computePayableAmount(
            numFromDec(booking.subTotal),
            numFromDec(booking.discount),
            numFromDec(booking.tax),
          ),
        );
      }
    }
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
    if (dto.payment?.paidAmount !== undefined) {
      booking.paidAmount = dec(dto.payment.paidAmount);
    }
    this.assertPaidAmountWithinPayable(
      numFromDec(booking.paidAmount),
      numFromDec(booking.totalAmount),
    );
    harmonizePaymentStatusWithAmounts(booking);
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
    this.applyBookingWindowFields(booking);
    const saved = await this.bookingRepo.save(booking);

    const full = await this.bookingRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ['items', 'user', 'paymentTransactions'],
    });

    if (
      dto.bookingStatus !== undefined &&
      ['cancelled', 'completed', 'no_show'].includes(full.bookingStatus)
    ) {
      await this.releaseFacilitySlotsForBooking(full);
    } else if (
      dto.bookingStatus !== undefined &&
      (full.bookingStatus === 'confirmed' || full.bookingStatus === 'pending')
    ) {
      await this.markFacilitySlotsBookedForBooking(full);
    } else if (
      dto.bookingStatus !== undefined &&
      full.bookingStatus === 'live' &&
      preLiveFacilityItems?.length
    ) {
      await this.releaseBookedFacilitySlotsForItems(
        tenantId,
        preLiveFacilityItems,
        full.id,
      );
      await this.markFacilitySlotsBlockedForLiveBooking(full);
    }

    const { locationsMap, courtToLocationMap, locationTimeZoneMap, courtNamesMap } =
      await this.resolveLocationMapping(full);
    const row = this.toApi(full, locationsMap, courtToLocationMap, locationTimeZoneMap, courtNamesMap, {
      projectLiveViewStatus: false,
      projectLiveOvertimePricing: true,
    });
    this.notifyBookingChange(tenantId, full.id, 'updated');
    return row;
  }


  async addPaymentTransaction(
    tenantId: string,
    bookingId: string,
    txn: {
      method: PaymentMethod;
      amount: number;
      bankAccountId?: string;
      transactionRef?: string;
      note?: string;
      paidAt?: string;
    },
  ): Promise<BookingApiRow> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId, tenantId },
      relations: ['items', 'user', 'paymentTransactions'],
    });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);

    const newTxn = this.paymentTxnRepo.create({
      bookingId,
      method: txn.method,
      amount: dec(txn.amount),
      bankAccountId: txn.bankAccountId,
      transactionRef: txn.transactionRef,
      note: txn.note,
      paidAt: txn.paidAt ? new Date(txn.paidAt) : new Date(),
    });
    await this.paymentTxnRepo.save(newTxn);

    const allTxns = await this.paymentTxnRepo.find({ where: { bookingId } });
    const totalPaid = allTxns.reduce((sum, t) => sum + Number(t.amount), 0);
    booking.paidAmount = dec(totalPaid);
    const primaryMethod = this.derivePrimaryMethod(allTxns);
    booking.paymentMethod = primaryMethod;
    harmonizePaymentStatusWithAmounts(booking);
    await this.bookingRepo.save(booking);

    const full = await this.bookingRepo.findOneOrFail({
      where: { id: bookingId },
      relations: ['items', 'user', 'paymentTransactions'],
    });
    const { locationsMap, courtToLocationMap, locationTimeZoneMap, courtNamesMap } =
      await this.resolveLocationMapping(full);
    const row = this.toApi(full, locationsMap, courtToLocationMap, locationTimeZoneMap, courtNamesMap);
    this.notifyBookingChange(tenantId, full.id, 'payment');
    return row;
  }

  async removePaymentTransaction(
    tenantId: string,
    bookingId: string,
    transactionId: string,
  ): Promise<BookingApiRow> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId, tenantId },
      relations: ['items', 'user', 'paymentTransactions'],
    });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);

    const txn = booking.paymentTransactions?.find((t) => t.id === transactionId);
    if (!txn) throw new NotFoundException(`Transaction ${transactionId} not found`);
    await this.paymentTxnRepo.delete({ id: transactionId });

    const remaining = await this.paymentTxnRepo.find({ where: { bookingId } });
    const totalPaid = remaining.reduce((sum, t) => sum + Number(t.amount), 0);
    booking.paidAmount = dec(totalPaid);
    if (remaining.length > 0) {
      booking.paymentMethod = this.derivePrimaryMethod(remaining);
    }
    harmonizePaymentStatusWithAmounts(booking);
    await this.bookingRepo.save(booking);

    const full = await this.bookingRepo.findOneOrFail({
      where: { id: bookingId },
      relations: ['items', 'user', 'paymentTransactions'],
    });
    const { locationsMap, courtToLocationMap, locationTimeZoneMap, courtNamesMap } =
      await this.resolveLocationMapping(full);
    const row = this.toApi(full, locationsMap, courtToLocationMap, locationTimeZoneMap, courtNamesMap);
    this.notifyBookingChange(tenantId, full.id, 'payment');
    return row;
  }

  private derivePrimaryMethod(txns: PaymentTransaction[]): PaymentMethod {
    if (txns.length === 0) return 'cash';
    let maxAmt = 0;
    let primary: PaymentMethod = txns[0].method;
    for (const t of txns) {
      const a = Number(t.amount);
      if (a > maxAmt) {
        maxAmt = a;
        primary = t.method;
      }
    }
    return primary;
  }

  private applyLiveWindowToBooking(booking: Booking): void {
    const startMinutes = getCurrentMinutesInKarachi();
    const liveDate = getCurrentDateInKarachi();
    booking.bookingStatus = 'live';
    booking.bookingDate = liveDate;
    const activeItems = (booking.items ?? []).filter(
      (item) => item.itemStatus !== 'cancelled',
    );
    if (!activeItems.length) return;

    const normalizedItems = activeItems.map((item) => {
      const fallbackDate = formatDateOnly(item.date ?? booking.bookingDate);
      const originalWindow = this.toSlotDateTimes(
        fallbackDate,
        item.startTime,
        item.endTime,
      );
      return {
        item,
        originalStart: item.startDatetime ?? originalWindow.startDatetime,
        originalEnd: item.endDatetime ?? originalWindow.endDatetime,
      };
    });
    const firstStartMs = Math.min(
      ...normalizedItems.map(({ originalStart }) => originalStart.getTime()),
    );
    const liveBase = new Date(`${liveDate}T00:00:00Z`);
    liveBase.setUTCMinutes(startMinutes);
    const liveBaseMs = liveBase.getTime();
    const slotMinutes = Math.max(
      1,
      Math.min(
        ...normalizedItems.map(({ originalStart, originalEnd }) =>
          Math.max(
            1,
            Math.round((originalEnd.getTime() - originalStart.getTime()) / 60000),
          ),
        ),
      ),
    );

    for (const row of normalizedItems) {
      const durationMinutesRaw = Math.max(
        1,
        Math.round((row.originalEnd.getTime() - row.originalStart.getTime()) / 60000),
      );
      const offsetMinutesRaw = Math.max(
        0,
        Math.round((row.originalStart.getTime() - firstStartMs) / 60000),
      );
      const durationMinutes =
        Math.max(1, Math.round(durationMinutesRaw / slotMinutes)) * slotMinutes;
      const offsetMinutes =
        Math.max(0, Math.round(offsetMinutesRaw / slotMinutes)) * slotMinutes;
      const liveStartDate = new Date(liveBaseMs + offsetMinutes * 60 * 1000);
      const liveEndDate = new Date(
        liveStartDate.getTime() + durationMinutes * 60 * 1000,
      );
      row.item.date = formatDateOnly(liveStartDate);
      row.item.startTime = liveStartDate.toISOString().slice(11, 16);
      row.item.endTime = liveEndDate.toISOString().slice(11, 16);
      row.item.startDatetime = liveStartDate;
      row.item.endDatetime = liveEndDate;
    }
  }

  async remove(tenantId: string, bookingId: string): Promise<{ ok: true }> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId, tenantId },
      relations: ['items'],
    });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);

    // Force everything to available before deleting
    booking.bookingStatus = 'cancelled';
    await this.bookingRepo.manager.query(
      'UPDATE booking_items SET "itemStatus" = $1 WHERE "bookingId" = $2',
      ['cancelled', booking.id],
    );
    await this.releaseFacilitySlotsForBooking(booking);
    await this.bookingRepo.remove(booking);
    this.notifyBookingChange(tenantId, bookingId, 'deleted');
    return { ok: true };
  }


  async editBookingFacilitySlots(
    tenantId: string,
    bookingId: string,
    blocked: boolean,
    addOnMinutes?: 30 | 60,
  ): Promise<{ ok: true; bookingId: string; blocked: boolean; extendedBy?: number }> {
    if (!addOnMinutes) {
      return { ok: true, bookingId, blocked };
    }

    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId, tenantId },
      relations: ['items'],
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }
    if (!booking.items?.length) {
      throw new BadRequestException('Booking has no items to extend');
    }
    if (booking.bookingStatus === 'cancelled' || booking.bookingStatus === 'no_show') {
      throw new BadRequestException('Only active bookings can be extended');
    }

    const itemsSorted = [...booking.items].sort((a, b) => {
      const aStart = (a.startDatetime ?? this.toSlotDateTimes(formatDateOnly(a.date ?? booking.bookingDate), a.startTime, a.endTime).startDatetime).getTime();
      const bStart = (b.startDatetime ?? this.toSlotDateTimes(formatDateOnly(b.date ?? booking.bookingDate), b.startTime, b.endTime).startDatetime).getTime();
      return aStart - bStart;
    });
    const baseItem = itemsSorted[itemsSorted.length - 1];
    const baseDate = formatDateOnly(baseItem.date ?? booking.bookingDate);
    const baseWindow = this.toSlotDateTimes(baseDate, baseItem.startTime, baseItem.endTime);
    const currentEnd = baseItem.endDatetime ?? baseWindow.endDatetime;

    const checkWindowStart = currentEnd;
    const checkWindowEnd = new Date(currentEnd.getTime() + 60 * 60 * 1000);

    const overlapCount = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.items', 'i')
      .where('b.tenantId = :tenantId', { tenantId })
      .andWhere('b.id <> :bookingId', { bookingId })
      .andWhere("b.bookingStatus IN ('pending', 'confirmed', 'live', 'completed')")
      .andWhere("i.itemStatus <> 'cancelled'")
      .andWhere('i.courtKind = :courtKind', { courtKind: baseItem.courtKind })
      .andWhere('i.courtId = :courtId', { courtId: baseItem.courtId })
      .andWhere('i.startDatetime < :checkWindowEnd', {
        checkWindowEnd: checkWindowEnd.toISOString(),
      })
      .andWhere('i.endDatetime > :checkWindowStart', {
        checkWindowStart: checkWindowStart.toISOString(),
      })
      .getCount();

    if (overlapCount > 0) {
      throw new ConflictException('Upcoming slot is not empty for extension');
    }

    const extensionStart = currentEnd;
    const extensionEnd = new Date(currentEnd.getTime() + addOnMinutes * 60 * 1000);
    const extensionStartTime = extensionStart.toISOString().slice(11, 16);
    const extensionEndTime = extensionEnd.toISOString().slice(11, 16);
    const extensionDate = formatDateOnly(extensionStart);

    const baseDurationMinutes = Math.max(
      1,
      Math.round((baseWindow.endDatetime.getTime() - baseWindow.startDatetime.getTime()) / 60000),
    );
    const basePrice = numFromDec(baseItem.price);
    const perMinutePrice = basePrice / baseDurationMinutes;
    const extensionPrice = Number((perMinutePrice * addOnMinutes).toFixed(2));

    const extraItem = this.bookingRepo.manager
      .getRepository(BookingItem)
      .create({
        bookingId: booking.id,
        courtKind: baseItem.courtKind,
        courtId: baseItem.courtId,
        slotId: undefined,
        date: extensionDate,
        startTime: extensionStartTime,
        endTime: extensionEndTime,
        startDatetime: extensionStart,
        endDatetime: extensionEnd,
        price: dec(extensionPrice),
        currency: baseItem.currency || 'PKR',
        itemStatus: baseItem.itemStatus === 'cancelled' ? 'confirmed' : baseItem.itemStatus,
      });
    await this.bookingRepo.manager.getRepository(BookingItem).save(extraItem);
    booking.items = await this.bookingRepo.manager.getRepository(BookingItem).find({
      where: { bookingId: booking.id },
    });

    booking.subTotal = dec(numFromDec(booking.subTotal) + extensionPrice);
    booking.totalAmount = dec(
      numFromDec(booking.subTotal) - numFromDec(booking.discount) + numFromDec(booking.tax),
    );
    harmonizePaymentStatusWithAmounts(booking);
    this.applyBookingWindowFields(booking);
    await this.bookingRepo.save(booking);

    const full = await this.bookingRepo.findOneOrFail({
      where: { id: bookingId, tenantId },
      relations: ['items'],
    });

    /**
     * Persist the slot grid for the newly created extension item so the facility-slot
     * view reflects the booking. `markFacilitySlotsBookedForBooking` and
     * `markFacilitySlotsBlockedForLiveBooking` are status-gated internally, so calling
     * both is safe — only the relevant one acts.
     */
    if (full.bookingStatus === 'confirmed' || full.bookingStatus === 'pending') {
      await this.markFacilitySlotsBookedForBooking(full);
    } else if (full.bookingStatus === 'live') {
      await this.markFacilitySlotsBlockedForLiveBooking(full);
    }

    this.notifyBookingChange(tenantId, bookingId, 'updated');
    return { ok: true, bookingId, blocked, extendedBy: addOnMinutes };
  }

  async getAvailabilityByTime(
    tenantId: string,
    params: {
      date: string;
      startTime: string;
      endTime: string;
      sportType?: BookingSportType;
      courtId?: string;
      courtKind?: CourtKind;
    },
  ) {
    const date = formatDateOnly(params.date);
    const nextDate = addDays(date, 1);
    const sport = params.sportType ?? 'padel';
    const isTurf = sport === 'futsal' || sport === 'cricket';
    const isTableTennis = sport === 'table-tennis';

    // --- Fetch the right courts based on sportType ---
    type CourtRow = {
      id: string;
      name: string;
      pricePerSlot: string | null;
      slotDurationMinutes: number | null;
      courtKind: 'padel_court' | 'turf_court' | 'table_tennis_court';
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
    } else if (isTableTennis) {
      const rows = await this.tableTennisRepo.find({
        where: { tenantId, isActive: true, courtStatus: 'active' },
        select: ['id', 'name', 'pricePerSlot', 'slotDurationMinutes'],
      });
      allCourts = rows.map((c) => ({
        id: c.id,
        name: c.name,
        pricePerSlot: c.pricePerSlot ?? null,
        slotDurationMinutes: c.slotDurationMinutes ?? null,
        courtKind: 'table_tennis_court' as const,
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

    const courtKindFilter: CourtKind = isTurf
      ? 'turf_court'
      : isTableTennis
        ? 'table_tennis_court'
        : 'padel_court';

    const qStartMin = toMinutes(params.startTime, false);
    const qEndMin = toMinutes(params.endTime, true);

    // Require a real template slot for the requested window on each court.
    const availableTemplateSlots = await this.facilitySlotRepo.find({
      where: [
        {
          tenantId,
          courtKind: courtKindFilter,
          slotDate: date,
          status: 'available',
        },
        {
          tenantId,
          courtKind: courtKindFilter,
          slotDate: nextDate,
          status: 'available',
        },
      ],
      select: ['courtId', 'slotDate', 'startTime', 'endTime'],
    });
    const templateAvailableIds = new Set<string>();
    for (const fs of availableTemplateSlots) {
      if (fs.slotDate !== date && fs.slotDate !== nextDate) continue;
      if (fs.slotDate === date) {
        if (
          toMinutes(fs.startTime, false) < qEndMin &&
          toMinutes(fs.endTime, true) > qStartMin
        ) {
          templateAvailableIds.add(fs.courtId);
        }
      } else if (qEndMin > 24 * 60 || qEndMin <= qStartMin) {
        const nextEndMin = qEndMin > 24 * 60 ? qEndMin - 24 * 60 : qEndMin;
        if (
          toMinutes(fs.startTime, false) < nextEndMin &&
          toMinutes(fs.endTime, true) > 0
        ) {
          templateAvailableIds.add(fs.courtId);
        }
      }
    }

    const facilitySlotsOnDate = await this.facilitySlotRepo.find({
      where: { tenantId, courtKind: courtKindFilter, slotDate: date },
      select: ['courtId'],
    });
    const courtsWithTemplateOnDate = new Set(
      facilitySlotsOnDate.map((s) => s.courtId),
    );
    for (const court of allCourts) {
      if (!courtsWithTemplateOnDate.has(court.id)) {
        templateAvailableIds.add(court.id);
      }
    }

    const queryStart = new Date(`${date}T00:00:00.000Z`);
    queryStart.setUTCMinutes(qStartMin);
    const queryEnd = new Date(`${date}T00:00:00.000Z`);
    queryEnd.setUTCMinutes(qEndMin);

    let candidateCourts = allCourts.filter((c) => templateAvailableIds.has(c.id));
    const filterCourtId = params.courtId?.trim();
    if (filterCourtId) {
      candidateCourts = candidateCourts.filter((c) => c.id === filterCourtId);
    }
    if (params.courtKind) {
      candidateCourts = candidateCourts.filter((c) => c.courtKind === params.courtKind);
    }
    const slotChecks = await Promise.all(
      candidateCourts.map(async (court) => {
        const { slots } = await this.getCourtSlots(tenantId, {
          kind: court.courtKind,
          courtId: court.id,
          date,
          startTime: params.startTime,
          endTime: params.endTime,
          availableOnly: true,
          skipCourtCheck: true,
        });
        return { court, available: slots.length > 0 };
      }),
    );

    const activeBookingItems = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.items', 'i')
      .andWhere('b.tenantId = :tenantId', { tenantId })
      .andWhere("b.bookingStatus IN ('confirmed', 'pending', 'live')")
      .andWhere("i.itemStatus <> 'cancelled'")
      .andWhere('i.courtKind = :kind', { kind: courtKindFilter })
      .andWhere('i.startDatetime < :queryEnd', { queryEnd: queryEnd.toISOString() })
      .andWhere('i.endDatetime > :queryStart', {
        queryStart: queryStart.toISOString(),
      })
      .select([
        'b.id AS bookingId',
        'i.id AS id',
        'i.courtId AS courtId',
        'i.startTime AS startTime',
        'i.endTime AS endTime',
        'i.itemStatus AS itemStatus',
      ])
      .getRawMany<{
        bookingId: string;
        id: string;
        courtId: string;
        startTime: string;
        endTime: string;
        itemStatus: BookingItemStatus;
      }>();

    return {
      date,
      startTime: params.startTime,
      endTime: params.endTime,
      sportType: sport,
      availableCourts: slotChecks
        .filter((x) => x.available)
        .map((x) => ({
          kind: x.court.courtKind,
          id: x.court.id,
          name: x.court.name,
          pricePerSlot: x.court.pricePerSlot ? Number(x.court.pricePerSlot) : null,
          slotDurationMinutes: x.court.slotDurationMinutes ?? null,
        })),
      bookedSlots: activeBookingItems.map((x) => ({
        kind: courtKindFilter,
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
      skipCourtCheck?: boolean;
      /** Suppress slot-grid diagnostics (internal post-create refresh). */
      quietLog?: boolean;
    },
  ) {
    if (!params.skipCourtCheck) {
      if (params.kind === 'padel_court') {
        await this.assertPadelCourtExists(tenantId, params.courtId);
      } else if (params.kind === 'turf_court') {
        await this.assertTurfCourtExists(tenantId, params.courtId);
      } else if (params.kind === 'table_tennis_court') {
        await this.assertTableTennisCourtExists(tenantId, params.courtId);
      } else {
        throw new BadRequestException('Unsupported court kind');
      }
    }
    const date = formatDateOnly(params.date);
    const start = toMinutes(params.startTime ?? '00:00', false);
    const end = toMinutes(params.endTime ?? '24:00', true);

    const slotStepMinutes = await this.resolveCourtSlotStepMinutes(
      tenantId,
      params.kind,
      params.courtId,
    );

    // Instead of completely generating grid steps, we will read the real slots from court_facility_slots
    // if they exist for this court and date, falling back to the configured grid loop if nothing exists.
    let facilitySlots = await this.facilitySlotRepo.find({
      where: {
        tenantId,
        courtKind: params.kind,
        courtId: params.courtId,
        slotDate: date,
      },
      order: { startTime: 'ASC' },
    });

    if (facilitySlots.length > 0) {
      await this.reconcileFacilitySlotsForCourtDate(
        tenantId,
        params.kind,
        params.courtId,
        date,
      );
      facilitySlots = await this.facilitySlotRepo.find({
        where: {
          tenantId,
          courtKind: params.kind,
          courtId: params.courtId,
          slotDate: date,
        },
        order: { startTime: 'ASC' },
      });
    }

    const queryStart = new Date(`${date}T00:00:00.000Z`);
    queryStart.setUTCMinutes(toMinutes(params.startTime ?? '00:00', false));
    const queryEnd = new Date(`${date}T00:00:00.000Z`);
    queryEnd.setUTCMinutes(toMinutes(params.endTime ?? '24:00', true));

    const rows = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.items', 'i')
      .andWhere('b.tenantId = :tenantId', { tenantId })
      .andWhere("b.bookingStatus IN ('confirmed', 'pending', 'live')")
      .andWhere("i.itemStatus <> 'cancelled'")
      .andWhere('i.courtKind = :kind', { kind: params.kind })
      .andWhere('i.courtId = :courtId', { courtId: params.courtId })
      .andWhere('i.startDatetime < :queryEnd', { queryEnd: queryEnd.toISOString() })
      .andWhere('i.endDatetime > :queryStart', {
        queryStart: queryStart.toISOString(),
      })
      .select([
        'b.id AS bookingId',
        'b.bookingDate AS bookingDate',
        'i.id AS id',
        'i.date AS itemDate',
        'i.startTime AS startTime',
        'i.endTime AS endTime',
        'i.startDatetime AS startDatetime',
        'i.endDatetime AS endDatetime',
        'i.itemStatus AS itemStatus',
      ])
      .getRawMany<{
        bookingId: string;
        bookingDate: string;
        id: string;
        itemDate: string | null;
        startTime: string;
        endTime: string;
        startDatetime: string;
        endDatetime: string;
        itemStatus: BookingItemStatus;
      }>();

    let slots: Array<any> = [];
    if (facilitySlots.length > 0) {
      for (const fs of facilitySlots) {
        if (toMinutes(fs.startTime, false) >= end || toMinutes(fs.endTime, true) <= start)
          continue;
        const displayEnd = facilitySlotEffectiveEndTime(
          fs.startTime,
          fs.endTime,
          slotStepMinutes,
        );
        const hit = rows.find((r) =>
          bookingItemCoversFacilitySlotOnGridDate(
            date,
            fs.startTime,
            fs.endTime,
            {
              ...r,
              endTime: resolveBookingMatchEndTime(
                {
                  startTime: r.startTime,
                  endTime: r.endTime,
                  startDatetime: r.startDatetime,
                  endDatetime: r.endDatetime,
                },
                slotStepMinutes,
              ),
            },
            slotStepMinutes,
          ),
        );
        if (hit) {
          slots.push({
            startTime: fs.startTime,
            endTime: displayEnd,
            availability: 'booked',
            bookingId: hit.bookingId,
            itemId: hit.id,
            status: hit.itemStatus,
          });
        } else if (fs.status === 'blocked') {
          slots.push({
            startTime: fs.startTime,
            endTime: displayEnd,
            availability: 'blocked',
          });
        } else {
          slots.push({
            startTime: fs.startTime,
            endTime: displayEnd,
            availability: 'available',
          });
        }
      }
    } else {
      // Fallback if no template slots were created
      for (let m = start; m < end; m += slotStepMinutes) {
        const s = minutesToTimeString(m);
        const e = minutesToTimeString(m + slotStepMinutes);
        const hit = rows.find((r) =>
          bookingItemCoversFacilitySlotOnGridDate(
            date,
            s,
            e,
            {
              ...r,
              endTime: resolveBookingMatchEndTime(
                {
                  startTime: r.startTime,
                  endTime: r.endTime,
                  startDatetime: r.startDatetime,
                  endDatetime: r.endDatetime,
                },
                slotStepMinutes,
              ),
            },
            slotStepMinutes,
          ),
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

    slots = filterSlotsForBookingPicker(slots, date);

    if (!params.quietLog) {
      const slotSummary = summarizeSlotAvailability(slots);
      bookingProcessStep(this.logger, 'api.getCourtSlots', {
        tenantId,
        courtKind: params.kind,
        courtId: params.courtId,
        date,
        window: `${params.startTime ?? '00:00'}-${params.endTime ?? '24:00'}`,
        availableOnly: Boolean(params.availableOnly),
        slotStepMinutes,
        facilitySlotRows: facilitySlots.length,
        gridSource: facilitySlots.length > 0 ? 'facility_slots' : 'fallback',
        activeBookingItems: rows.length,
        activeItems: summarizeActiveBookingItems(rows, slotStepMinutes),
        ...slotSummary,
      });
      if (
        slotSummary.segmentCount > 0 &&
        slotSummary.availableCount === 0 &&
        rows.length <= 2
      ) {
        bookingProcessWarn(this.logger, 'api.getCourtSlots.all-unavailable', {
          tenantId,
          courtId: params.courtId,
          date,
          activeBookingItems: rows.length,
          activeItems: summarizeActiveBookingItems(rows, slotStepMinutes),
          ...slotSummary,
        });
      }
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
      skipCourtCheck?: boolean;
    },
  ) {
    const gridStarted = Date.now();
    bookingProcessStep(this.logger, 'api.getCourtSlotGrid.request', {
      tenantId,
      courtKind: params.kind,
      courtId: params.courtId,
      date: params.date,
      startTime: params.startTime,
      endTime: params.endTime,
      availableOnly: Boolean(params.availableOnly),
    });

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
    }

    const gridResult = {
      date: data.date,
      kind: data.kind,
      courtId: data.courtId,
      segmentMinutes:
        this.inferStepMinutesFromSlots(data.slots) ??
        (await this.resolveCourtSlotStepMinutes(
          tenantId,
          params.kind,
          params.courtId,
        )),
      gridStartTime: params.startTime ?? '00:00',
      gridEndTime: params.endTime ?? '24:00',
      availableOnly: params.availableOnly || undefined,
      segments,
    };

    bookingProcessStep(this.logger, 'api.getCourtSlotGrid.success', {
      tenantId,
      courtKind: params.kind,
      courtId: params.courtId,
      date: params.date,
      ms: Date.now() - gridStarted,
      availableOnly: Boolean(params.availableOnly),
      segmentMinutes: gridResult.segmentMinutes,
      ...summarizeSlotAvailability(segments),
    });

    return gridResult;
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
    } else if (params.kind === 'table_tennis_court') {
      const court = await this.assertTableTennisCourtExists(
        tenantId,
        params.courtId,
      );
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

    const slotStepMinutes = await this.resolveCourtSlotStepMinutes(
      tenantId,
      params.kind,
      params.courtId,
    );

    if (templateLines.length > 0) {
      for (const line of templateLines) {
        const endTime =
          line.endTime === '24:00'
            ? facilitySlotEffectiveEndTime(
                line.startTime,
                line.endTime,
                slotStepMinutes,
              )
            : line.endTime;
        values.push({
          tenantId,
          courtKind: params.kind,
          courtId: params.courtId,
          slotDate: date,
          startTime: line.startTime,
          endTime,
          status: line.status as any,
        });
      }
    } else {
      for (let m = 0; m < 24 * 60; m += slotStepMinutes) {
        values.push({
          tenantId,
          courtKind: params.kind,
          courtId: params.courtId,
          slotDate: date,
          startTime: minutesToTimeString(m),
          endTime: minutesToTimeString(m + slotStepMinutes),
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
    } else if (params.kind === 'table_tennis_court') {
      await this.assertTableTennisCourtExists(tenantId, params.courtId);
    } else {
      throw new BadRequestException('Unsupported court kind');
    }
    const slotDate = formatDateOnly(params.date);
    const existing = await this.facilitySlotRepo.findOne({
      where: {
        tenantId,
        courtKind: params.kind,
        courtId: params.courtId,
        slotDate,
        startTime: params.startTime,
      },
      select: ['endTime'],
    });
    const endTime =
      existing?.endTime ??
      minutesToTimeString(
        toMinutes(params.startTime) +
          (await this.resolveCourtSlotStepMinutes(
            tenantId,
            params.kind,
            params.courtId,
          )),
      );
    await this.facilitySlotRepo.upsert(
      {
        tenantId,
        courtKind: params.kind,
        courtId: params.courtId,
        slotDate,
        startTime: params.startTime,
        endTime,
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
    if (params.status === 'blocked') {
      this.logFacilitySlotStatusChange('blocked', {
        tenantId,
        courtKind: params.kind,
        courtId: params.courtId,
        slotDate,
        startTime: params.startTime,
        endTime,
      });
    }
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
    } else if (params.kind === 'table_tennis_court') {
      await this.assertTableTennisCourtExists(tenantId, params.courtId);
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
    date?: string;
    startTime?: string;
    endTime?: string;
    courtType?: string;
    tableTennisPlayType?: string;
  }) {
    const date = params.date
      ? formatDateOnly(params.date)
      : getCurrentDateInKarachi();
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

    const tableTennisBatch = kinds.includes('table_tennis_court')
      ? await this.tableTennisRepo.find({
          where: {
            businessLocationId: params.locationId,
            isActive: true,
            courtStatus: In(['active', 'draft']) as any,
          },
          select: ['id', 'name', 'tenantId', 'pricePerSlot', 'meta'],
        })
      : [];

    const buildSlotsResponseForDate = async (targetDate: string) => {
      const facilities: Array<{
        kind: CourtKind;
        courtId: string;
        name: string;
        price?: number;
        slots: Array<{ startTime: string; endTime: string; availability: string }>;
      }> = [];

      const requestedType = (params.courtType || '').toLowerCase();
      const isFutsalRequested = requestedType.includes('futsal');
      const isCricketRequested = requestedType.includes('cricket');

      const [padelFacilities, turfFacilities, tableTennisFacilities] =
        await Promise.all([
          Promise.all(
            padelBatch.map(async (court) => {
              const grid = await this.getCourtSlotGrid(court.tenantId, {
                kind: 'padel_court',
                courtId: court.id,
                date: targetDate,
                startTime: start,
                endTime: end,
                availableOnly: false,
                skipCourtCheck: true,
              });
              return {
                kind: 'padel_court' as const,
                courtId: court.id,
                name: court.name,
                price: Number(court.pricePerSlot || 0),
                slots: grid.segments.map((s: any) => ({
                  startTime: s.startTime,
                  endTime: s.endTime,
                  availability: s.state === 'free' ? 'available' : s.state,
                })),
              };
            }),
          ),
          Promise.all(
            turfBatch
              .filter((court) => {
                if (
                  isFutsalRequested &&
                  !court.supportedSports?.includes('futsal')
                )
                  return false;
                if (
                  isCricketRequested &&
                  !court.supportedSports?.includes('cricket')
                )
                  return false;
                return true;
              })
              .map(async (court) => {
                const grid = await this.getCourtSlotGrid(court.tenantId, {
                  kind: 'turf_court',
                  courtId: court.id,
                  date: targetDate,
                  startTime: start,
                  endTime: end,
                  availableOnly: false,
                  skipCourtCheck: true,
                });
                return {
                  kind: 'turf_court' as const,
                  courtId: court.id,
                  name: court.name,
                  price: this.resolveTurfPrice(court, params.courtType),
                  slots: grid.segments.map((s: any) => ({
                    startTime: s.startTime,
                    endTime: s.endTime,
                    availability: s.state === 'free' ? 'available' : s.state,
                  })),
                };
              }),
          ),
          Promise.all(
            tableTennisBatch.map(async (court) => {
              const grid = await this.getCourtSlotGrid(court.tenantId, {
                kind: 'table_tennis_court',
                courtId: court.id,
                date: targetDate,
                startTime: start,
                endTime: end,
                availableOnly: false,
                skipCourtCheck: true,
              });
              return {
                kind: 'table_tennis_court' as const,
                courtId: court.id,
                name: court.name,
                price: this.resolveTableTennisPrice(
                  court,
                  params.tableTennisPlayType,
                ),
                slots: grid.segments.map((s: any) => ({
                  startTime: s.startTime,
                  endTime: s.endTime,
                  availability: s.state === 'free' ? 'available' : s.state,
                })),
              };
            }),
          ),
        ]);

      facilities.push(...padelFacilities, ...turfFacilities, ...tableTennisFacilities);

      const unionMap = new Map<
        string,
        { startTime: string; endTime: string; availability: string }
      >();
      for (const f of facilities) {
        for (const s of f.slots) {
          const key = `${s.startTime}\t${s.endTime}`;
          const existing = unionMap.get(key);
          if (
            !existing ||
            (existing.availability === 'blocked' &&
              s.availability === 'available')
          ) {
            unionMap.set(key, s as any);
          }
        }
      }

      return {
        date: targetDate,
        facilities,
        unionSlots: [...unionMap.values()].sort((a, b) =>
          a.startTime.localeCompare(b.startTime),
        ),
      };
    };

    const currentDateSlots = await buildSlotsResponseForDate(date);

    const loc = await this.locationRepo.findOne({
      where: { id: params.locationId },
      select: ['workingHours'],
    });
    const dayWindow = getWorkingDayWindow(loc?.workingHours, date);
    const allowsOvernightContinuation =
      !dayWindow.closed &&
      isOvernightWorkingWindow(dayWindow.open, dayWindow.close);

    const filterContinuationDay = <
      T extends {
        date: string;
        facilities: Array<{
          slots: Array<{ startTime: string; endTime: string; availability: string }>;
        }>;
        unionSlots: Array<{ startTime: string; endTime: string; availability: string }>;
      },
    >(
      day: T,
    ): T => {
      const keep = (s: { startTime: string }) =>
        isOvernightContinuationSlot(s.startTime, dayWindow.close);
      return {
        ...day,
        facilities: day.facilities.map((f) => ({
          ...f,
          slots: f.slots.filter(keep),
        })),
        unionSlots: day.unionSlots.filter(keep),
      };
    };

    let nextDateSlots: (typeof currentDateSlots) | null = null;
    const additionalDates: typeof currentDateSlots[] = [];
    if (allowsOvernightContinuation) {
      const nextBuilt = filterContinuationDay(
        await buildSlotsResponseForDate(addDays(date, 1)),
      );
      if (nextBuilt.unionSlots.length > 0) {
        nextDateSlots = nextBuilt;
        additionalDates.push(nextBuilt);
      }
    }

    const unionSlotsAll = [
      ...currentDateSlots.unionSlots.map((slot) => ({
        date,
        ...slot,
      })),
      ...(nextDateSlots?.unionSlots.map((slot) => ({
        date: nextDateSlots!.date,
        ...slot,
      })) ?? []),
    ];

    return {
      date,
      locationId: params.locationId,
      courtType: params.courtType ?? 'all',
      facilities: currentDateSlots.facilities,
      unionSlots: currentDateSlots.unionSlots,
      unionSlotsAll,
      nextDateSlots,
      additionalDates,
    };
  }

  private mapPadelToLiveDto(c: PadelCourt): LivePadelCourtDto {
    return {
      id: c.id,
      tenantId: c.tenantId,
      businessLocationId: c.businessLocationId ?? null,
      name: c.name,
      arenaLabel: c.arenaLabel ?? null,
      courtStatus: c.courtStatus,
      pricePerSlot: Number(c.pricePerSlot || 0),
      imageUrls: c.imageUrls ?? null,
      slotDurationMinutes: c.slotDurationMinutes ?? null,
      timeSlotTemplateId: c.timeSlotTemplateId,
      isActive: c.isActive,
    };
  }

  private mapTableTennisToLiveDto(c: TableTennisCourt): LivePadelCourtDto {
    return {
      id: c.id,
      tenantId: c.tenantId,
      businessLocationId: c.businessLocationId ?? null,
      name: c.name,
      arenaLabel: null,
      courtStatus: c.courtStatus,
      pricePerSlot: Number(c.pricePerSlot || 0),
      imageUrls: c.imageUrls ?? null,
      slotDurationMinutes: c.slotDurationMinutes ?? null,
      timeSlotTemplateId: c.timeSlotTemplateId,
      isActive: c.isActive,
    };
  }

  private mapTurfToLiveDto(t: TurfCourt): LiveTurfCourtDto {
    return {
      id: t.id,
      tenantId: t.tenantId,
      branchId: t.branchId,
      name: t.name,
      status: t.status,
      supportedSports: t.supportedSports ?? [],
      length: t.length ?? null,
      width: t.width ?? null,
      coveredType: t.coveredType,
      surfaceType: t.surfaceType ?? null,
      slotDuration: t.slotDuration,
      bufferTime: t.bufferTime,
      timeSlotTemplateId: t.timeSlotTemplateId,
      pricing: t.pricing,
      sportConfig: t.sportConfig,
    };
  }

  private async assertCanReadLiveFacilities(
    requesterUserId: string,
    tenantId: string | undefined,
    locationId: string,
  ): Promise<BusinessLocation> {
    const isPlatformOwner = await this.iamService.hasAnyRole(
      requesterUserId,
      ['platform-owner'],
    );
    const constraint = await this.iamService.getLocationAdminConstraint(
      requesterUserId,
    );
    if (constraint && constraint !== locationId) {
      throw new ForbiddenException('Not allowed to view this location');
    }
    if (!isPlatformOwner && !tenantId) {
      throw new UnauthorizedException('Tenant ID is required');
    }
    const loc = await this.locationRepo.findOne({
      where: { id: locationId },
      relations: ['business'],
    });
    if (!loc) {
      throw new NotFoundException(`Location ${locationId} not found`);
    }
    if (tenantId && loc.business?.tenantId !== tenantId) {
      throw new ForbiddenException('Location does not belong to this tenant');
    }
    return loc;
  }

  /**
   * One payload for the mobile “Live facilities” page: padel + turf (futsal/cricket) catalog
   * plus the same day slot grid as `getLocationFacilitiesAvailableSlots` (replaces
   * separate `/arena/turf-courts` and `/facilities/available-slots` for that screen).
   */
  async getLocationLiveFacilities(params: {
    requesterUserId: string;
    tenantId?: string;
    locationId: string;
    date: string;
    startTime?: string;
    endTime?: string;
    courtType?: string;
  }): Promise<LocationLiveFacilitiesView> {
    const loc = await this.assertCanReadLiveFacilities(
      params.requesterUserId,
      params.tenantId,
      params.locationId,
    );
    const timeZone = (loc.timezone || '').trim() || 'Asia/Karachi';
    const tenantIdForBookings = loc.business?.tenantId;

    const [slotsPayload, padelRows, turfRows, tableTennisRows] =
      await Promise.all([
        this.getLocationFacilitiesAvailableSlots({
          locationId: params.locationId,
          date: params.date,
          startTime: params.startTime,
          endTime: params.endTime,
          courtType: params.courtType,
        }),
        this.padelRepo.find({
          where: {
            businessLocationId: params.locationId,
            isActive: true,
            courtStatus: In(['active', 'draft']) as any,
          },
          order: { name: 'ASC' },
        }),
        this.turfRepo.find({
          where: { branchId: params.locationId, status: 'active' },
          order: { name: 'ASC' },
        }),
        this.tableTennisRepo.find({
          where: {
            businessLocationId: params.locationId,
            isActive: true,
            courtStatus: In(['active', 'draft']) as any,
          },
          order: { name: 'ASC' },
        }),
      ]);
    const futsal: LiveTurfCourtDto[] = [];
    const cricket: LiveTurfCourtDto[] = [];
    for (const t of turfRows) {
      const d = this.mapTurfToLiveDto(t);
      if (t.supportedSports?.includes('futsal')) futsal.push(d);
      if (t.supportedSports?.includes('cricket')) cricket.push(d);
    }
    const liveSlots = slotsPayload as LiveFacilitiesSlotsPayload;

    const allCourtIds = [
      ...padelRows.map((p) => p.id),
      ...turfRows.map((t) => t.id),
      ...tableTennisRows.map((t) => t.id),
    ];

    let liveBookings: Booking[] = [];
    if (tenantIdForBookings && allCourtIds.length) {
      const ymd = ymdInTimeZone(timeZone);
      const from = addDaysYmd(ymd, -7);
      const to = addDaysYmd(ymd, 90);
      const courtSet = new Set(allCourtIds);
      const rows = await this.bookingRepo.find({
        where: {
          tenantId: tenantIdForBookings,
          bookingDate: Between(from, to),
          bookingStatus: In([
            'pending',
            'confirmed',
            'live',
          ] as BookingStatus[]),
        },
        relations: ['items', 'user', 'paymentTransactions'],
      });
      liveBookings = rows.filter((b) =>
        b.items?.some((i) => courtSet.has(i.courtId)),
      );
    }

    const facilityPlayStatus: FacilityPlaySnapshot[] = [];
    for (const c of padelRows) {
      facilityPlayStatus.push(
        buildPlaySnapshot(liveBookings, 'padel_court', c.id, c.name, {
          timeZone,
          facilityActive: Boolean(c.isActive) && c.courtStatus !== 'maintenance',
          statusRaw: c.courtStatus,
        }),
      );
    }
    for (const t of turfRows) {
      facilityPlayStatus.push(
        buildPlaySnapshot(liveBookings, 'turf_court', t.id, t.name, {
          timeZone,
          facilityActive: t.status === 'active',
          statusRaw: t.status,
        }),
      );
    }
    for (const t of tableTennisRows) {
      facilityPlayStatus.push(
        buildPlaySnapshot(
          liveBookings,
          'table_tennis_court',
          t.id,
          t.name,
          {
            timeZone,
            facilityActive: Boolean(t.isActive) && t.courtStatus !== 'maintenance',
            statusRaw: t.courtStatus,
          },
        ),
      );
    }

    return {
      locationId: params.locationId,
      generatedAt: new Date().toISOString(),
      timeZone,
      facilityPlayStatus,
      padelCourts: padelRows.map((c) => this.mapPadelToLiveDto(c)),
      tableTennisCourts: tableTennisRows.map((c) => this.mapTableTennisToLiveDto(c)),
      turfCourts: { futsal, cricket },
      liveSlots,
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

  private normalizeTableTennisPlayType(
    raw?: string,
  ): TableTennisPlayType | null {
    const s = (raw || '').trim().toLowerCase();
    if (s === 'singles') return 'singles';
    if (s === 'doubles') return 'doubles';
    return null;
  }

  private resolveTableTennisPrice(
    court: { pricePerSlot?: string | null; meta?: Record<string, unknown> | null },
    playType?: string,
  ): number {
    const meta = (court.meta || {}) as Record<string, unknown>;
    const normalized = this.normalizeTableTennisPlayType(playType);
    const parsePrice = (value: unknown): number | null => {
      const n = Number(value);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    if (normalized === 'singles') {
      const p = parsePrice(meta.singlesPricePerSlot ?? meta.singlesPricePerHour);
      if (p !== null) return p;
    }
    if (normalized === 'doubles') {
      const p = parsePrice(meta.doublesPricePerSlot ?? meta.doublesPricePerHour);
      if (p !== null) return p;
    }
    return Number(court.pricePerSlot || 0);
  }

  async getLocationFacilitiesAvailableForSlot(params: {
    locationId: string;
    date: string;
    startTime: string;
    endTime?: string;
    courtType?: string;
    tableTennisPlayType?: string;
  }) {
    const date = formatDateOnly(params.date);
    const nextDate = addDays(date, 1);
    const start = params.startTime ?? '09:00';
    const end =
      params.endTime ??
      minutesToTimeString(
        toMinutes(start, false) + BookingsService.DEFAULT_SLOT_STEP_MINUTES,
      );

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

    const tableTennisAvailBatch = kinds.includes('table_tennis_court')
      ? await this.tableTennisRepo.find({
          where: {
            businessLocationId: params.locationId,
            isActive: true,
            courtStatus: In(['active', 'draft']) as any,
          },
          select: ['id', 'name', 'tenantId', 'pricePerSlot', 'meta'],
        })
      : [];

    const allCourts = [
      ...padelBatch.map((c) => ({ ...c, kind: 'padel_court' as const })),
      ...turfBatch
        .filter((c) => {
          const s = (params.courtType || '').toLowerCase();
          if (s.includes('futsal') && !c.supportedSports?.includes('futsal'))
            return false;
          if (s.includes('cricket') && !c.supportedSports?.includes('cricket'))
            return false;
          return true;
        })
        .map((c) => ({ ...c, kind: 'turf_court' as const })),
      ...tableTennisAvailBatch.map((c) => ({
        ...c,
        kind: 'table_tennis_court' as const,
      })),
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
                    : c.kind === 'table_tennis_court'
                      ? this.resolveTableTennisPrice(
                          c as any,
                          params.tableTennisPlayType,
                        )
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

  async getLocationEmptySlots30Days(params: {
    locationId: string;
    courtType?: string;
  }) {
    const startDate = getCurrentDateInKarachi();
    const endDate = addDays(startDate, 29);
    const days: string[] = Array.from({ length: 30 }, (_, i) =>
      addDays(startDate, i),
    );

    const kinds = this.normalizeKindForEmptySlotCounts(params.courtType);
    const includePadel = kinds.includes('padel_court');
    const includeTurf = kinds.includes('turf_court');
    const includeTableTennis = kinds.includes('table_tennis_court');

    const [padelBatch, turfBatch, tableTennisBatch] = await Promise.all([
      includePadel
        ? this.padelRepo.find({
            where: {
              businessLocationId: params.locationId,
              isActive: true,
              courtStatus: In(['active', 'draft']) as any,
            },
            select: ['id'],
          })
        : Promise.resolve([]),
      includeTurf
        ? this.turfRepo.find({
            where: { branchId: params.locationId, status: 'active' },
            select: ['id'],
          })
        : Promise.resolve([]),
      includeTableTennis
        ? this.tableTennisRepo.find({
            where: {
              businessLocationId: params.locationId,
              isActive: true,
              courtStatus: In(['active', 'draft']) as any,
            },
            select: ['id'],
          })
        : Promise.resolve([]),
    ]);

    const courtPairs: Array<{ kind: CourtKind; courtId: string }> = [
      ...padelBatch.map((c) => ({ kind: 'padel_court' as const, courtId: c.id })),
      ...turfBatch.map((c) => ({ kind: 'turf_court' as const, courtId: c.id })),
      ...tableTennisBatch.map((c) => ({
        kind: 'table_tennis_court' as const,
        courtId: c.id,
      })),
    ];

    if (courtPairs.length === 0) {
      return {
        locationId: params.locationId,
        startDate,
        endDate,
        courtType: params.courtType ?? 'all',
        daily: days.map((date) => ({ date, emptySlots: 0 })),
      };
    }

    const qb = this.facilitySlotRepo
      .createQueryBuilder('fs')
      .select('fs.slotDate', 'slotDate')
      .addSelect('COUNT(*)::int', 'emptySlots')
      .where('fs.slotDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere("fs.status = 'available'");

    qb.andWhere(
      new Brackets((subQb) => {
        courtPairs.forEach((pair, idx) => {
          const kindKey = `kind${idx}`;
          const courtIdKey = `courtId${idx}`;
          subQb.orWhere(
            `(fs.courtKind = :${kindKey} AND fs.courtId = :${courtIdKey})`,
            {
              [kindKey]: pair.kind,
              [courtIdKey]: pair.courtId,
            },
          );
        });
      }),
    );

    const rows = await qb
      .groupBy('fs.slotDate')
      .orderBy('fs.slotDate', 'ASC')
      .getRawMany<{ slotDate: string; emptySlots: string }>();

    const countByDate = new Map<string, number>(
      rows.map((row) => [row.slotDate, Number(row.emptySlots) || 0]),
    );

    return {
      locationId: params.locationId,
      startDate,
      endDate,
      courtType: params.courtType ?? 'all',
      daily: days.map((date) => ({
        date,
        emptySlots: countByDate.get(date) ?? 0,
      })),
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
    if (
      s === 'table-tennis' ||
      s === 'table_tennis' ||
      s === 'table_tennis_court' ||
      s === 'tabletennis'
    ) {
      return ['table_tennis_court'];
    }
    return ['padel_court', 'turf_court'];
  }

  private normalizeKindForEmptySlotCounts(raw?: string): CourtKind[] {
    if (!raw) return ['padel_court', 'turf_court', 'table_tennis_court'];
    const s = raw.toLowerCase().trim();
    if (s === 'padel' || s === 'padel_court') return ['padel_court'];
    if (s === 'futsal' || s === 'cricket' || s === 'turf' || s === 'turf_court')
      return ['turf_court'];
    if (
      s === 'table-tennis' ||
      s === 'table_tennis' ||
      s === 'table_tennis_court' ||
      s === 'tabletennis'
    ) {
      return ['table_tennis_court'];
    }
    return ['padel_court', 'turf_court', 'table_tennis_court'];
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

  private async markFacilitySlotsBookedForBooking(booking: Booking): Promise<void> {
    if (booking.bookingStatus !== 'confirmed' && booking.bookingStatus !== 'pending') {
      return;
    }
    const items = (booking.items ?? []).filter((i) => i.itemStatus !== 'cancelled');
    if (!items.length) return;
    await this.reconcileFacilitySlotsForBookingItems(
      booking.tenantId,
      items,
      formatDateOnly(booking.bookingDate),
    );
  }

  private async markFacilitySlotsBlockedForLiveBooking(
    booking: Booking,
  ): Promise<void> {
    if (booking.bookingStatus !== 'live') return;
    const items = (booking.items ?? []).filter((i) => i.itemStatus !== 'cancelled');
    if (!items.length) return;
    await this.setFacilitySlotsStatusForItems({
      tenantId: booking.tenantId,
      items,
      targetStatus: 'blocked',
    });
  }

  private async releaseBookedFacilitySlotsForItems(
    tenantId: string,
    items: BookingItem[],
    excludeBookingId?: string,
  ): Promise<void> {
    if (!items.length) return;
    await this.setFacilitySlotsStatusForItems({
      tenantId,
      items,
      targetStatus: 'available',
      excludeBookingId,
    });
  }

  private async releaseFacilitySlotsForBooking(booking: Booking): Promise<void> {
    if (!booking.items?.length) return;
    await this.releaseBookedFacilitySlotsForItems(
      booking.tenantId,
      booking.items,
      booking.id,
    );
    await this.unblockStaleFacilitySlotsForBooking(booking);
  }

  private async unblockStaleFacilitySlotsForBooking(
    booking: Booking,
  ): Promise<void> {
    if (!booking.items?.length) return;
    const touched = new Set<string>();
    const bd = formatDateOnly(booking.bookingDate);
    for (const item of booking.items) {
      const windows = this.itemFacilitySlotSyncWindows(item, bd);
      for (const { slotDate } of windows) {
        touched.add(`${item.courtKind}\t${item.courtId}\t${slotDate}`);
      }
    }
    for (const key of touched) {
      const [courtKind, courtId, slotDate] = key.split('\t') as [
        CourtKind,
        string,
        string,
      ];
      await this.reconcileFacilitySlotsForCourtDate(
        booking.tenantId,
        courtKind,
        courtId,
        slotDate,
      );
    }
  }

  private async setFacilitySlotsStatusForItems(params: {
    tenantId: string;
    items: BookingItem[];
    targetStatus: CourtFacilitySlotStatus;
    excludeBookingId?: string;
  }): Promise<void> {
    const { tenantId, items, targetStatus, excludeBookingId } = params;
    if (!items.length) return;

    for (const item of items) {
      const slotStep = await this.resolveCourtSlotStepMinutes(
        tenantId,
        item.courtKind,
        item.courtId,
      );
      if (
        (targetStatus === 'booked' || targetStatus === 'blocked') &&
        item.slotId
      ) {
        const slotDate = formatDateOnly(item.date ?? item.startDatetime ?? new Date());
        const exactRow = await this.facilitySlotRepo.findOne({
          where: {
            id: item.slotId,
            tenantId,
            courtKind: item.courtKind,
            courtId: item.courtId,
            slotDate,
          },
          select: ['startTime', 'endTime'],
        });
        const exactUpdate = await this.facilitySlotRepo.update(
          {
            id: item.slotId,
            tenantId,
            courtKind: item.courtKind,
            courtId: item.courtId,
            slotDate,
          },
          { status: targetStatus },
        );
        if ((exactUpdate.affected ?? 0) > 0 && exactRow) {
          this.logFacilitySlotStatusChange(targetStatus, {
            tenantId,
            courtKind: item.courtKind,
            courtId: item.courtId,
            slotDate,
            startTime: exactRow.startTime,
            endTime: exactRow.endTime,
            slotId: item.slotId,
          });
          continue;
        }
      }
      const windows = this.itemFacilitySlotSyncWindows(
        item,
        formatDateOnly(item.date ?? item.startDatetime ?? new Date()),
        slotStep,
      );
      const activeOnCourt =
        targetStatus === 'available'
          ? await this.bookingRepo.find({
              where: {
                tenantId,
                bookingStatus: In([
                  'pending',
                  'confirmed',
                  'live',
                  'completed',
                ]),
              },
              relations: ['items'],
            })
          : [];

      for (const { slotDate, windowStart, windowEnd } of windows) {
        if (targetStatus === 'blocked' || targetStatus === 'booked') {
          await this.updateFacilitySlotsInWindow({
            tenantId,
            courtKind: item.courtKind,
            courtId: item.courtId,
            slotDate,
            windowStart,
            windowEnd,
            targetStatus,
          });
          continue;
        }

        const candidateSlots = await this.facilitySlotRepo.find({
          where: {
            tenantId,
            courtKind: item.courtKind,
            courtId: item.courtId,
            slotDate,
          },
          select: ['slotDate', 'startTime', 'endTime'],
        });

        for (const slot of candidateSlots) {
          if (
            !facilitySlotOverlapsWallWindow(
              slot.startTime,
              slot.endTime,
              windowStart,
              windowEnd,
              slotStep,
            )
          ) {
            continue;
          }

          let hasOtherBooking = false;
          for (const b of activeOnCourt) {
            if (excludeBookingId && b.id === excludeBookingId) continue;
            const bd = formatDateOnly(b.bookingDate);
            for (const bi of b.items ?? []) {
              if (bi.itemStatus === 'cancelled') continue;
              if (bi.courtKind !== item.courtKind || bi.courtId !== item.courtId)
                continue;
              const biWindows = this.itemFacilitySlotSyncWindows(
                bi,
                formatDateOnly(bi.date ?? bd),
                slotStep,
              );
              for (const w of biWindows) {
                if (w.slotDate !== slotDate) continue;
                if (
                  facilitySlotOverlapsWallWindow(
                    slot.startTime,
                    slot.endTime,
                    w.windowStart,
                    w.windowEnd,
                    slotStep,
                  )
                ) {
                  hasOtherBooking = true;
                  break;
                }
              }
              if (hasOtherBooking) break;
            }
            if (hasOtherBooking) break;
          }
          if (hasOtherBooking) continue;

          await this.facilitySlotRepo.update(
            {
              tenantId,
              courtKind: item.courtKind,
              courtId: item.courtId,
              slotDate: slot.slotDate,
              startTime: slot.startTime,
            },
            { status: 'available' },
          );
        }
      }
    }
  }

  async completePastBookings() {
    const now = new Date();

    // Auto-cancel bookings that never started (still pending/confirmed) after end time.
    const noShowBookings = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.items', 'i')
      .where("b.bookingStatus IN ('pending', 'confirmed')")
      .groupBy('b.id')
      .having('MAX(i.endDatetime) < :now', { now: now.toISOString() })
      .select('b.id', 'id')
      .getRawMany<{ id: string }>();
    if (noShowBookings.length > 0) {
      const ids = noShowBookings.map((b) => b.id);
      const rows = await this.bookingRepo.find({
        where: { id: In(ids) },
        relations: ['items'],
      });
      for (const booking of rows) {
        booking.bookingStatus = 'cancelled';
        booking.cancellationReason =
          booking.cancellationReason ||
          'Auto-cancelled because booking was not started before end time.';
        for (const item of booking.items ?? []) {
          item.itemStatus = 'cancelled';
        }
        this.applyBookingWindowFields(booking);
        await this.bookingRepo.save(booking);
        await this.releaseFacilitySlotsForBooking(booking);
      }
      this.logger.log(
        `Auto-cancelled ${rows.length} unstarted bookings past end time.`,
      );
    }

    // Complete only live bookings once their play window has ended.
    const pastBookings = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.items', 'i')
      .where("b.bookingStatus = 'live'")
      .groupBy('b.id')
      .having('MAX(i.endDatetime) < :now', { now: now.toISOString() })
      .select('b.id', 'id')
      .getRawMany<{ id: string }>();

    if (pastBookings.length === 0) return;

    const ids = pastBookings.map((b) => b.id);
    const liveBookings = await this.bookingRepo.find({
      where: { id: In(ids), bookingStatus: 'live' },
      relations: ['items'],
    });
    for (const booking of liveBookings) {
      let extraSubTotal = 0;
      for (const item of booking.items ?? []) {
        if (item.itemStatus === 'cancelled') continue;
        if (!item.startDatetime || !item.endDatetime) continue;
        if (now <= item.endDatetime) continue;

        const durationMinutes = Math.max(
          1,
          Math.round(
            (item.endDatetime.getTime() - item.startDatetime.getTime()) / 60000,
          ),
        );
        const perMinuteRate = numFromDec(item.price) / durationMinutes;
        const overtimeMinutes = Math.max(
          0,
          Math.ceil((now.getTime() - item.endDatetime.getTime()) / 60000),
        );
        if (overtimeMinutes <= 0) continue;

        const overtimeCharge = Number((perMinuteRate * overtimeMinutes).toFixed(2));
        extraSubTotal += overtimeCharge;
        item.price = dec(numFromDec(item.price) + overtimeCharge);
        item.endDatetime = now;
        item.endTime = now.toISOString().slice(11, 16);
        item.date = now.toISOString().slice(0, 10);
        item.itemStatus = 'cancelled';
      }

      if (extraSubTotal > 0) {
        booking.subTotal = dec(numFromDec(booking.subTotal) + extraSubTotal);
        booking.totalAmount = dec(
          this.computePayableAmount(
            numFromDec(booking.subTotal),
            numFromDec(booking.discount),
            numFromDec(booking.tax),
          ),
        );
        harmonizePaymentStatusWithAmounts(booking);
      }
      this.applyBookingWindowFields(booking);
      await this.bookingRepo.save(booking);
    }
    await this.bookingRepo.update({ id: In(ids) }, { bookingStatus: 'completed' });
    for (const booking of liveBookings) {
      booking.bookingStatus = 'completed';
      await this.releaseFacilitySlotsForBooking(booking);
    }
    this.logger.log(`Marked ${ids.length} active bookings as completed.`);
  }

  private async matchPadelCourtFromParsedText(params: {
    tenantId: string;
    rawText: string;
    courtPhrase: string | null;
    courtNumber: number | null;
    businessLocationId?: string;
  }): Promise<{
    courtId: string | null;
    courtName: string | null;
    candidatesConsidered: number;
    ambiguous: boolean;
    weakDefaultResolution?: boolean;
  }> {
    const { tenantId, rawText, courtPhrase, courtNumber, businessLocationId } =
      params;
    const where: { tenantId: string; isActive: boolean; businessLocationId?: string } =
      { tenantId, isActive: true };
    if (businessLocationId?.trim()) {
      where.businessLocationId = businessLocationId.trim();
    }
    const courts = await this.padelRepo.find({
      where,
      select: ['id', 'name', 'arenaLabel'],
    });
    if (!courts.length) {
      return {
        courtId: null,
        courtName: null,
        candidatesConsidered: 0,
        ambiguous: false,
      };
    }
    const textL = rawText.toLowerCase();
    const phraseL = (courtPhrase ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
    const scored: Array<{ id: string; name: string; score: number }> = [];
    for (const c of courts) {
      const nl = c.name.toLowerCase();
      const al = (c.arenaLabel ?? '').toLowerCase();
      let score = 0;
      if (phraseL && nl === phraseL) score += 220;
      if (phraseL && nl.includes(phraseL)) score += 160;
      if (phraseL && phraseL.includes(nl)) score += 140;
      if (phraseL) {
        const short = phraseL.replace(/^padel\s+/i, '').trim();
        if (short && nl.includes(short)) score += 100;
      }
      if (textL.includes(nl)) score += 40;
      if (al && textL.includes(al)) score += 35;
      if (courtNumber != null) {
        const n = courtNumber;
        if (new RegExp(`(?:court|^|\\s)0*${n}(?:\\s|$|-)`, 'i').test(c.name)) {
          score += 90;
        }
        if (nl.includes(`court ${n}`) || nl.endsWith(` ${n}`) || nl.endsWith(`-${n}`)) {
          score += 85;
        }
      }
      if (score > 0) scored.push({ id: c.id, name: c.name, score });
    }
    if (!scored.length && courtNumber != null) {
      for (const c of courts) {
        if (c.name.includes(String(courtNumber))) {
          scored.push({ id: c.id, name: c.name, score: 8 });
        }
      }
    }
    scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const top = scored[0];
    const second = scored[1];
    if (!top || top.score < 8) {
      return {
        courtId: null,
        courtName: null,
        candidatesConsidered: courts.length,
        ambiguous: false,
      };
    }
    const ambiguous = Boolean(second && second.score >= top.score - 4);
    if (ambiguous && top.score <= 45) {
      return {
        courtId: top.id,
        courtName: top.name,
        candidatesConsidered: courts.length,
        ambiguous: false,
        weakDefaultResolution: true,
      };
    }
    if (ambiguous) {
      return {
        courtId: null,
        courtName: null,
        candidatesConsidered: courts.length,
        ambiguous: true,
      };
    }
    return {
      courtId: top.id,
      courtName: top.name,
      candidatesConsidered: courts.length,
      ambiguous: false,
    };
  }

  private async matchTurfCourtFromParsedText(params: {
    tenantId: string;
    rawText: string;
    courtPhrase: string | null;
    courtNumber: number | null;
    businessLocationId?: string;
    preferredSport: 'futsal' | 'cricket';
  }): Promise<{
    courtId: string | null;
    courtName: string | null;
    candidatesConsidered: number;
    ambiguous: boolean;
  }> {
    const { tenantId, rawText, courtPhrase, courtNumber, businessLocationId, preferredSport } =
      params;
    const where: FindOptionsWhere<TurfCourt> = {
      tenantId,
      status: 'active',
    };
    if (businessLocationId?.trim()) {
      where.branchId = businessLocationId.trim();
    }
    let courts = await this.turfRepo.find({
      where,
      select: ['id', 'name', 'supportedSports'],
    });
    const sportFiltered = courts.filter((c) => {
      const ss = c.supportedSports ?? [];
      if (!ss.length) return true;
      return ss.includes(preferredSport);
    });
    if (sportFiltered.length) courts = sportFiltered;

    if (!courts.length) {
      return {
        courtId: null,
        courtName: null,
        candidatesConsidered: 0,
        ambiguous: false,
      };
    }
    const textL = rawText.toLowerCase();
    const phraseL = (courtPhrase ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
    const scored: Array<{ id: string; name: string; score: number }> = [];
    for (const c of courts) {
      const nl = c.name.toLowerCase();
      let score = 0;
      if (phraseL && nl === phraseL) score += 220;
      if (phraseL && nl.includes(phraseL)) score += 160;
      if (phraseL && phraseL.includes(nl)) score += 140;
      if (phraseL) {
        const short = phraseL
          .replace(/^(?:padel|futsal|cricket|turf)\s+/i, '')
          .trim();
        if (short && nl.includes(short)) score += 100;
      }
      if (textL.includes(nl)) score += 40;
      if (courtNumber != null) {
        const n = courtNumber;
        if (new RegExp(`(?:court|^|\\s)0*${n}(?:\\s|$|-)`, 'i').test(c.name)) {
          score += 90;
        }
        if (nl.includes(`court ${n}`) || nl.endsWith(` ${n}`) || nl.endsWith(`-${n}`)) {
          score += 85;
        }
      }
      if (score > 0) scored.push({ id: c.id, name: c.name, score });
    }
    if (!scored.length && courtNumber != null) {
      for (const c of courts) {
        if (c.name.includes(String(courtNumber))) {
          scored.push({ id: c.id, name: c.name, score: 8 });
        }
      }
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0];
    const second = scored[1];
    if (!top || top.score < 8) {
      return {
        courtId: null,
        courtName: null,
        candidatesConsidered: courts.length,
        ambiguous: false,
      };
    }
    const ambiguous = Boolean(second && second.score >= top.score - 4);
    if (ambiguous) {
      return {
        courtId: null,
        courtName: null,
        candidatesConsidered: courts.length,
        ambiguous: true,
      };
    }
    return {
      courtId: top.id,
      courtName: top.name,
      candidatesConsidered: courts.length,
      ambiguous: false,
    };
  }

  async parseFreeTextBooking(input: {
    tenantId: string;
    message: string;
    referenceDateYmd?: string;
    businessLocationId?: string;
  }): Promise<
    FreeTextBookingParseResult & {
      courtId: string | null;
      courtName: string | null;
      courtKind: CourtKind | null;
      ambiguousCourt: boolean;
    }
  > {
    const ref = input.referenceDateYmd?.trim() || getCurrentDateInKarachi();
    let parsed = parseFreeTextBookingMessage(input.message, ref);
    const mergeLlmIfPresent = async (
      label: 'OpenAI' | 'Gemini',
      fetcher: () => Promise<
        (Partial<FreeTextBookingParseResult> & { formattedSummary?: string | null }) | null
      >,
    ) => {
      try {
        const llm = await fetcher();
        if (llm) {
          const hasLlmValue = Object.entries(llm).some(([, v]) => {
            if (v == null) return false;
            if (typeof v === 'string') return v.trim().length > 0;
            if (typeof v === 'number') return Number.isFinite(v);
            return false;
          });
          if (hasLlmValue) {
            parsed = mergeGeminiOverHeuristic(parsed, llm, input.message.trim());
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        parsed.warnings.push(`${label}: ${msg} — using rule-based fields only.`);
        this.logger.warn(`${label} booking parse failed: ${msg}`);
      }
    };
    if (isOpenAiBookingParseConfigured()) {
      await mergeLlmIfPresent('OpenAI', () =>
        fetchOpenAiBookingExtract(input.message, ref),
      );
    } else if (isGeminiBookingParseConfigured()) {
      await mergeLlmIfPresent('Gemini', () =>
        fetchGeminiBookingExtract(input.message, ref),
      );
    }
    const todayKhi = getCurrentDateInKarachi();
    if (parsed.bookingDate && formatDateOnly(parsed.bookingDate) < todayKhi) {
      parsed.warnings.push(
        'Booking date is before today (Asia/Karachi). Choose today or a future date before creating.',
      );
    }
    if (parsed.startTime && parsed.endTime) {
      const spanMinutes = diffMinutes(parsed.startTime, parsed.endTime);
      if (spanMinutes < 60) {
        parsed.warnings.push(
          'Parsed time range is under 1 hour. Extend the window to at least 60 minutes before creating.',
        );
      }
    }
    let courtId: string | null = null;
    let courtName: string | null = null;
    let courtKind: CourtKind | null = null;
    let ambiguousCourt = false;
    if (parsed.inferredSport === 'padel') {
      const match = await this.matchPadelCourtFromParsedText({
        tenantId: input.tenantId,
        rawText: input.message,
        courtPhrase: parsed.courtPhrase,
        courtNumber: parsed.courtNumber,
        businessLocationId: input.businessLocationId,
      });
      ambiguousCourt = match.ambiguous;
      if (match.ambiguous) {
        parsed.warnings.push(
          'Multiple padel courts matched the text; choose the facility manually.',
        );
      } else if (match.courtId) {
        courtId = match.courtId;
        courtName = match.courtName;
        courtKind = 'padel_court';
        if (match.weakDefaultResolution) {
          parsed.warnings.push(
            'Several padel venues scored equally; one was chosen by default. Verify the court before saving.',
          );
        }
      } else if (match.candidatesConsidered > 0) {
        parsed.warnings.push(
          'Could not match a padel court name to your venues; select the court manually.',
        );
      }
    } else if (parsed.inferredSport === 'futsal' || parsed.inferredSport === 'cricket') {
      const match = await this.matchTurfCourtFromParsedText({
        tenantId: input.tenantId,
        rawText: input.message,
        courtPhrase: parsed.courtPhrase,
        courtNumber: parsed.courtNumber,
        businessLocationId: input.businessLocationId,
        preferredSport: parsed.inferredSport,
      });
      ambiguousCourt = match.ambiguous;
      if (match.ambiguous) {
        parsed.warnings.push(
          'Multiple turf courts matched the text; choose the facility manually.',
        );
      } else if (match.courtId) {
        courtId = match.courtId;
        courtName = match.courtName;
        courtKind = 'turf_court';
      } else if (match.candidatesConsidered > 0) {
        parsed.warnings.push(
          'Could not match a turf court name to your venues for this sport; select the court manually.',
        );
      }
    } else if (parsed.inferredSport) {
      parsed.warnings.push(
        'Only padel and turf (futsal/cricket) courts are auto-resolved from free text today; pick table tennis manually.',
      );
    }
    return { ...parsed, courtId, courtName, courtKind, ambiguousCourt };
  }
}
