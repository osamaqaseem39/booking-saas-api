import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { CricketIndoorCourt } from '../arena/cricket-indoor/entities/cricket-indoor-court.entity';
import { FutsalField } from '../arena/futsal-field/entities/futsal-field.entity';
import { PadelCourt } from '../arena/padel-court/entities/padel-court.entity';
import { TurfCourt } from '../arena/turf-court/entities/turf-court.entity';
import { BookingItem } from '../bookings/entities/booking-item.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { IamService } from '../iam/iam.service';
import { CreateBusinessLocationDto } from './dto/create-business-location.dto';
import { CreateBusinessDto } from './dto/create-business.dto';
import { ListLocationCitiesDto } from './dto/list-location-cities.dto';
import { SearchLocationsQueryDto } from './dto/search-locations-query.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpdateBusinessLocationDto } from './dto/update-business-location.dto';
import { BusinessLocation } from './entities/business-location.entity';
import { Business } from './entities/business.entity';
import { BusinessMembership } from './entities/business-membership.entity';
import { normalizeLocationFacilityTypesForApi } from './business-location.constants';
import {
  coordinateToJsonNumber,
  normalizeCoordinateForPersist,
} from './geo-coordinates';

@Injectable()
export class BusinessesService {
  constructor(
    private readonly iamService: IamService,
    @InjectRepository(Business)
    private readonly businessesRepository: Repository<Business>,
    @InjectRepository(BusinessMembership)
    private readonly membershipsRepository: Repository<BusinessMembership>,
    @InjectRepository(BusinessLocation)
    private readonly locationsRepository: Repository<BusinessLocation>,
    @InjectRepository(TurfCourt)
    private readonly turfCourtRepository: Repository<TurfCourt>,
    @InjectRepository(FutsalField)
    private readonly futsalFieldRepository: Repository<FutsalField>,
    @InjectRepository(PadelCourt)
    private readonly padelCourtRepository: Repository<PadelCourt>,
    @InjectRepository(CricketIndoorCourt)
    private readonly cricketIndoorCourtRepository: Repository<CricketIndoorCourt>,
    @InjectRepository(BookingItem)
    private readonly bookingItemRepository: Repository<BookingItem>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
  ) {}

  private toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  /**
   * API uses `status` as the single write field; `isActive` is derived and kept in sync for queries.
   */
  private normalizeLocationStatus(raw: string | undefined): {
    status: string;
    isActive: boolean;
  } {
    const s = (raw ?? 'active').trim().toLowerCase();
    if (s === 'inactive') {
      return { status: 'inactive', isActive: false };
    }
    return { status: 'active', isActive: true };
  }

  private isSchemaMismatchError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const message = `${error.message ?? ''}`.toLowerCase();
    return (
      message.includes('column') &&
      message.includes('does not exist') &&
      message.includes('business_locations')
    );
  }

  private isBusinessSchemaMismatchError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const message = `${error.message ?? ''}`.toLowerCase();
    return (
      message.includes('column') &&
      message.includes('does not exist') &&
      (message.includes('businesses') || message.includes('business.'))
    );
  }

  async listForRequester(requesterUserId: string) {
    let businesses: Business[];
    try {
      businesses = await this.businessesRepository.find({
        order: { createdAt: 'DESC' },
      });
    } catch (error: unknown) {
      if (this.isBusinessSchemaMismatchError(error)) {
        throw new ServiceUnavailableException(
          'Businesses schema is out of date. Run latest database migrations and retry.',
        );
      }
      throw error;
    }
    const memberships = await this.membershipsRepository.find();
    const isPlatformOwner = await this.iamService.hasAnyRole(requesterUserId, [
      'platform-owner',
    ]);
    const scoped = isPlatformOwner
      ? businesses
      : businesses.filter((b) =>
          memberships.some(
            (m) => m.businessId === b.id && m.userId === requesterUserId,
          ),
        );
    return scoped.map((business) => ({
      ...business,
      memberships: memberships.filter(
        (membership) => membership.businessId === business.id,
      ),
    }));
  }

  async getDashboardView(requesterUserId: string) {
    const businesses = await this.listForRequester(requesterUserId);
    if (businesses.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        scope: { businessCount: 0, locationCount: 0 },
        totals: {
          courtCount: 0,
          bookingCount: 0,
          confirmedBookingCount: 0,
          pendingBookingCount: 0,
          cancelledBookingCount: 0,
          revenueTotal: 0,
          revenuePaid: 0,
        },
        businesses: [],
      };
    }

    const businessIds = businesses.map((b) => b.id);
    const tenantByBusinessId = new Map(
      businesses.map((b) => [b.id, (b as Business).tenantId]),
    );
    const businessIdByTenantId = new Map(
      businesses.map((b) => [(b as Business).tenantId, b.id]),
    );

    const locationCountRows = await this.locationsRepository
      .createQueryBuilder('location')
      .select('location.businessId', 'businessId')
      .addSelect('COUNT(*)', 'count')
      .where('location.businessId IN (:...businessIds)', { businessIds })
      .groupBy('location.businessId')
      .getRawMany<{ businessId: string; count: string }>();
    const locationCountByBusinessId = new Map(
      locationCountRows.map((row) => [row.businessId, Number.parseInt(row.count, 10)]),
    );

    const locations = await this.locationsRepository.find({
      where: { businessId: In(businessIds) },
      select: ['id', 'businessId'],
    });
    const locationIds = locations.map((x) => x.id);
    const businessIdByLocationId = new Map(locations.map((x) => [x.id, x.businessId]));
    const courtKeysByLocationId = await this.loadCourtKeysByLocationId(locationIds);

    const courtCountByBusinessId = new Map<string, number>();
    for (const [locationId, courtKeys] of courtKeysByLocationId.entries()) {
      const businessId = businessIdByLocationId.get(locationId);
      if (!businessId) {
        continue;
      }
      courtCountByBusinessId.set(
        businessId,
        (courtCountByBusinessId.get(businessId) ?? 0) + courtKeys.length,
      );
    }

    const tenantIds = Array.from(
      new Set(businesses.map((b) => (b as Business).tenantId).filter(Boolean)),
    );
    let bookingRows: Array<{
      tenantId: string;
      bookingCount: string;
      confirmedBookingCount: string;
      pendingBookingCount: string;
      cancelledBookingCount: string;
      revenueTotal: string;
      revenuePaid: string;
    }> = [];
    if (tenantIds.length > 0) {
      bookingRows = await this.bookingRepository
        .createQueryBuilder('booking')
        .select('booking.tenantId', 'tenantId')
        .addSelect('COUNT(*)', 'bookingCount')
        .addSelect(
          "SUM(CASE WHEN booking.bookingStatus = 'confirmed' THEN 1 ELSE 0 END)",
          'confirmedBookingCount',
        )
        .addSelect(
          "SUM(CASE WHEN booking.bookingStatus = 'pending' THEN 1 ELSE 0 END)",
          'pendingBookingCount',
        )
        .addSelect(
          "SUM(CASE WHEN booking.bookingStatus = 'cancelled' THEN 1 ELSE 0 END)",
          'cancelledBookingCount',
        )
        .addSelect('COALESCE(SUM(booking.totalAmount), 0)', 'revenueTotal')
        .addSelect(
          "COALESCE(SUM(CASE WHEN booking.paymentStatus = 'paid' THEN booking.totalAmount ELSE 0 END), 0)",
          'revenuePaid',
        )
        .where('booking.tenantId IN (:...tenantIds)', { tenantIds })
        .groupBy('booking.tenantId')
        .getRawMany();
    }

    const bookingByBusinessId = new Map<
      string,
      {
        bookingCount: number;
        confirmedBookingCount: number;
        pendingBookingCount: number;
        cancelledBookingCount: number;
        revenueTotal: number;
        revenuePaid: number;
      }
    >();
    for (const row of bookingRows) {
      const businessId = businessIdByTenantId.get(row.tenantId);
      if (!businessId) {
        continue;
      }
      bookingByBusinessId.set(businessId, {
        bookingCount: Number.parseInt(row.bookingCount, 10) || 0,
        confirmedBookingCount: Number.parseInt(row.confirmedBookingCount, 10) || 0,
        pendingBookingCount: Number.parseInt(row.pendingBookingCount, 10) || 0,
        cancelledBookingCount: Number.parseInt(row.cancelledBookingCount, 10) || 0,
        revenueTotal: this.toNumber(row.revenueTotal),
        revenuePaid: this.toNumber(row.revenuePaid),
      });
    }

    const businessViews = businesses.map((business) => {
      const typedBusiness = business as Business;
      const locationCount = locationCountByBusinessId.get(typedBusiness.id) ?? 0;
      const courtCount = courtCountByBusinessId.get(typedBusiness.id) ?? 0;
      const booking = bookingByBusinessId.get(typedBusiness.id) ?? {
        bookingCount: 0,
        confirmedBookingCount: 0,
        pendingBookingCount: 0,
        cancelledBookingCount: 0,
        revenueTotal: 0,
        revenuePaid: 0,
      };
      return {
        businessId: typedBusiness.id,
        tenantId: tenantByBusinessId.get(typedBusiness.id),
        businessName: typedBusiness.businessName,
        status: typedBusiness.status,
        locationCount,
        courtCount,
        ...booking,
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      scope: {
        businessCount: businesses.length,
        locationCount: businessViews.reduce((sum, row) => sum + row.locationCount, 0),
      },
      totals: {
        courtCount: businessViews.reduce((sum, row) => sum + row.courtCount, 0),
        bookingCount: businessViews.reduce((sum, row) => sum + row.bookingCount, 0),
        confirmedBookingCount: businessViews.reduce(
          (sum, row) => sum + row.confirmedBookingCount,
          0,
        ),
        pendingBookingCount: businessViews.reduce(
          (sum, row) => sum + row.pendingBookingCount,
          0,
        ),
        cancelledBookingCount: businessViews.reduce(
          (sum, row) => sum + row.cancelledBookingCount,
          0,
        ),
        revenueTotal: Number(
          businessViews
            .reduce((sum, row) => sum + row.revenueTotal, 0)
            .toFixed(2),
        ),
        revenuePaid: Number(
          businessViews
            .reduce((sum, row) => sum + row.revenuePaid, 0)
            .toFixed(2),
        ),
      },
      businesses: businessViews,
    };
  }

  async onboardBusiness(dto: CreateBusinessDto) {
    let duplicate: Business | null;
    try {
      duplicate = await this.businessesRepository.findOne({
        where: { businessName: dto.businessName },
      });
    } catch (error: unknown) {
      if (this.isBusinessSchemaMismatchError(error)) {
        throw new ServiceUnavailableException(
          'Businesses schema is out of date. Run latest database migrations and retry.',
        );
      }
      throw error;
    }
    if (duplicate) {
      throw new BadRequestException(
        `Business ${dto.businessName} already exists in onboarding store`,
      );
    }

    const normalizedStatus = (dto.status ?? 'active').trim().toLowerCase();
    const ownerProfile = dto.owner
      ? {
          name: dto.owner.name?.trim(),
          email: dto.owner.email?.trim().toLowerCase(),
          phone: dto.owner.phone?.trim(),
        }
      : undefined;

    const business = this.businessesRepository.create({
      tenantId: dto.tenantId ?? randomUUID(),
      businessName: dto.businessName,
      legalName: dto.legalName,
      businessType: dto.businessType?.trim(),
      sportsOffered:
        dto.sportsOffered?.map((x) => x.trim()).filter(Boolean) ?? undefined,
      owner: ownerProfile,
      subscription: dto.subscription
        ? {
            plan: dto.subscription.plan?.trim(),
            status: dto.subscription.status?.trim(),
            billingCycle: dto.subscription.billingCycle?.trim(),
          }
        : undefined,
      settings: dto.settings
        ? {
            timezone: dto.settings.timezone?.trim(),
            currency: dto.settings.currency?.trim().toUpperCase(),
            allowOnlinePayments: dto.settings.allowOnlinePayments ?? false,
          }
        : undefined,
      status: normalizedStatus === 'inactive' ? 'inactive' : 'active',
    });
    let savedBusiness: Business;
    try {
      savedBusiness = await this.businessesRepository.save(business);
    } catch (error: unknown) {
      if (this.isBusinessSchemaMismatchError(error)) {
        throw new ServiceUnavailableException(
          'Businesses schema is out of date. Run latest database migrations and retry.',
        );
      }
      throw error;
    }

    const adminSource = dto.admin
      ? {
          fullName: dto.admin.fullName,
          email: dto.admin.email,
          phone: dto.admin.phone,
          password: dto.admin.password,
        }
      : dto.owner
        ? {
            fullName: dto.owner.name,
            email: dto.owner.email,
            phone: dto.owner.phone,
            // Owner payload in upgraded schema may omit password.
            // Keep onboarding backward-compatible by generating a strong temporary one.
            password:
              dto.owner.password ??
              `Tmp#${randomUUID().replace(/-/g, '').slice(0, 12)}`,
          }
        : null;
    if (!adminSource) {
      throw new BadRequestException(
        'Provide either admin or owner details in onboarding payload',
      );
    }

    const adminUser = await this.iamService.ensureUser({
      fullName: adminSource.fullName,
      email: adminSource.email,
      phone: adminSource.phone,
      password: adminSource.password,
    });
    await this.iamService.assignRole(adminUser.id, 'business-admin');

    const membership = this.membershipsRepository.create({
      businessId: savedBusiness.id,
      userId: adminUser.id,
      membershipRole: 'owner',
    });
    const savedMembership = await this.membershipsRepository.save(membership);

    return { business: savedBusiness, adminUser, membership: savedMembership };
  }

  async listLocationsForRequester(requesterUserId: string) {
    let allLocations: BusinessLocation[];
    try {
      allLocations = await this.locationsRepository.find({
        order: { createdAt: 'DESC' },
      });
    } catch (error: unknown) {
      if (this.isSchemaMismatchError(error)) {
        throw new ServiceUnavailableException(
          'Business locations schema is out of date. Run latest database migrations and retry.',
        );
      }
      throw error;
    }
    let businesses: Business[];
    try {
      businesses = await this.businessesRepository.find();
    } catch (error: unknown) {
      if (this.isBusinessSchemaMismatchError(error)) {
        throw new ServiceUnavailableException(
          'Businesses schema is out of date. Run latest database migrations and retry.',
        );
      }
      throw error;
    }
    const businessById = new Map(businesses.map((b) => [b.id, b]));
    const isPlatformOwner = await this.iamService.hasAnyRole(requesterUserId, [
      'platform-owner',
    ]);
    let scoped = allLocations;
    if (!isPlatformOwner) {
      const allowedBusinessIds = new Set(
        (await this.listForRequester(requesterUserId)).map((b) => b.id),
      );
      scoped = allLocations.filter((l) => allowedBusinessIds.has(l.businessId));
    }
    return this.buildLocationListRowsWithFacilityInfo(scoped, businessById);
  }

  /**
   * Public / unauthenticated listing: all locations (e.g. end-user discovery).
   * Each row includes active facility court summaries and derived counts.
   */
  async listAllLocationsPublic() {
    let allLocations: BusinessLocation[];
    try {
      allLocations = await this.locationsRepository.find({
        order: { createdAt: 'DESC' },
      });
    } catch (error: unknown) {
      if (this.isSchemaMismatchError(error)) {
        throw new ServiceUnavailableException(
          'Business locations schema is out of date. Run latest database migrations and retry.',
        );
      }
      throw error;
    }
    let businesses: Business[];
    try {
      businesses = await this.businessesRepository.find();
    } catch (error: unknown) {
      if (this.isBusinessSchemaMismatchError(error)) {
        throw new ServiceUnavailableException(
          'Businesses schema is out of date. Run latest database migrations and retry.',
        );
      }
      throw error;
    }
    const businessById = new Map(businesses.map((b) => [b.id, b]));
    return this.buildLocationListRowsWithFacilityInfo(allLocations, businessById);
  }

  /**
   * Same data as {@link listAllLocationsPublic}, wrapped as `{ locations }` for clients
   * that already call `/businesses/locations/facility-counts`.
   */
  async listLocationsWithFacilityCountsPublic(): Promise<{
    locations: Awaited<ReturnType<BusinessesService['listAllLocationsPublic']>>;
  }> {
    const locations = await this.listAllLocationsPublic();
    return { locations };
  }

  private emptyFacilityCountsRecord(): Record<
    'padel-court' | 'futsal-field' | 'cricket-indoor' | 'turf-court',
    number
  > {
    return {
      'padel-court': 0,
      'futsal-field': 0,
      'cricket-indoor': 0,
      'turf-court': 0,
    };
  }

  private countsFromCourtSummaries(
    courts: Array<{
      facilityType:
        | 'padel-court'
        | 'futsal-field'
        | 'cricket-indoor'
        | 'turf-court';
    }>,
  ): Record<
    'padel-court' | 'futsal-field' | 'cricket-indoor' | 'turf-court',
    number
  > {
    const base = this.emptyFacilityCountsRecord();
    for (const c of courts) {
      base[c.facilityType]++;
    }
    return base;
  }

  private async buildLocationListRowsWithFacilityInfo(
    locations: BusinessLocation[],
    businessById: Map<string, Business>,
  ): Promise<
    Array<
      ReturnType<BusinessesService['toLocationListRow']> & {
        facilityCounts: Record<
          'padel-court' | 'futsal-field' | 'cricket-indoor' | 'turf-court',
          number
        >;
        facilityCourts: Array<{
          facilityType:
            | 'padel-court'
            | 'futsal-field'
            | 'cricket-indoor'
            | 'turf-court';
          id: string;
          name: string;
        }>;
      }
    >
  > {
    const locationIds = locations.map((l) => l.id);
    const courtsByLocationId =
      await this.loadFacilityCourtSummariesByLocationId(locationIds);
    return locations.map((loc) => {
      const b = businessById.get(loc.businessId);
      const facilityCourts = courtsByLocationId.get(loc.id) ?? [];
      return {
        ...this.toLocationListRow(loc, b),
        facilityCounts: this.countsFromCourtSummaries(facilityCourts),
        facilityCourts,
      };
    });
  }

  /** Active bookable courts/fields per location (same filters as booking discovery). */
  private async loadFacilityCourtSummariesByLocationId(
    locationIds: string[],
  ): Promise<
    Map<
      string,
      Array<{
        facilityType:
          | 'padel-court'
          | 'futsal-field'
          | 'cricket-indoor'
          | 'turf-court';
        id: string;
        name: string;
      }>
    >
  > {
    const map = new Map<
      string,
      Array<{
        facilityType:
          | 'padel-court'
          | 'futsal-field'
          | 'cricket-indoor'
          | 'turf-court';
        id: string;
        name: string;
      }>
    >();
    for (const id of locationIds) {
      map.set(id, []);
    }
    if (locationIds.length === 0) {
      return map;
    }

    const whereLoc = { businessLocationId: In(locationIds) };

    const push = (
      locId: string | null | undefined,
      facilityType:
        | 'padel-court'
        | 'futsal-field'
        | 'cricket-indoor'
        | 'turf-court',
      id: string,
      name: string,
    ) => {
      if (!locId) return;
      const list = map.get(locId);
      if (!list) return;
      list.push({ facilityType, id, name });
    };

    const [padel, futsal, cricket, turf] = await Promise.all([
      this.padelCourtRepository.find({
        where: { ...whereLoc, isActive: true, courtStatus: 'active' },
        select: ['id', 'name', 'businessLocationId'],
      }),
      this.futsalFieldRepository.find({
        where: { ...whereLoc, isActive: true },
        select: ['id', 'name', 'businessLocationId'],
      }),
      this.cricketIndoorCourtRepository.find({
        where: { ...whereLoc, isActive: true },
        select: ['id', 'name', 'businessLocationId'],
      }),
      this.turfCourtRepository.find({
        where: { ...whereLoc, courtStatus: 'active' },
        select: ['id', 'name', 'businessLocationId'],
      }),
    ]);

    for (const row of padel) {
      push(row.businessLocationId, 'padel-court', row.id, row.name);
    }
    for (const row of futsal) {
      push(row.businessLocationId, 'futsal-field', row.id, row.name);
    }
    for (const row of cricket) {
      push(row.businessLocationId, 'cricket-indoor', row.id, row.name);
    }
    for (const row of turf) {
      push(row.businessLocationId, 'turf-court', row.id, row.name);
    }

    return map;
  }

  private toLocationListRow(loc: BusinessLocation, b: Business | undefined) {
    return {
      id: loc.id,
      businessId: loc.businessId,
      locationType: loc.locationType,
      facilityTypes: normalizeLocationFacilityTypesForApi(loc.facilityTypes),
      name: loc.name,
      addressLine: loc.addressLine,
      details: loc.details ?? null,
      city: loc.city,
      area: loc.area,
      country: loc.country,
      latitude: coordinateToJsonNumber(loc.latitude),
      longitude: coordinateToJsonNumber(loc.longitude),
      phone: loc.phone,
      manager: loc.manager,
      workingHours: loc.workingHours,
      timezone: loc.timezone,
      currency: loc.currency,
      logo: loc.logo ?? null,
      bannerImage: loc.bannerImage ?? null,
      gallery: loc.gallery ?? [],
      status: loc.status,
      isActive: loc.isActive,
      createdAt: loc.createdAt,
      business: b
        ? {
            id: b.id,
            businessName: b.businessName,
            tenantId: b.tenantId,
          }
        : null,
    };
  }

  async listLocationCitiesForRequester(
    requesterUserId: string,
    dto: ListLocationCitiesDto,
  ): Promise<{ cities: string[] }> {
    const rows = await this.listLocationsForRequester(requesterUserId);
    const query = dto.q?.trim().toLowerCase();

    const unique = new Set<string>();
    for (const row of rows) {
      const city = row.city?.trim();
      if (!city) continue;
      if (query && !city.toLowerCase().includes(query)) continue;
      unique.add(city);
    }

    const cities = Array.from(unique).sort((a, b) => a.localeCompare(b));
    const limit = dto.limit ?? cities.length;
    return { cities: cities.slice(0, limit) };
  }

  async listLocationCitiesPublic(
    dto: ListLocationCitiesDto,
  ): Promise<{ cities: string[] }> {
    const rows = await this.listAllLocationsPublic();
    const query = dto.q?.trim().toLowerCase();

    const unique = new Set<string>();
    for (const row of rows) {
      const city = row.city?.trim();
      if (!city) continue;
      if (query && !city.toLowerCase().includes(query)) continue;
      unique.add(city);
    }

    const cities = Array.from(unique).sort((a, b) => a.localeCompare(b));
    const limit = dto.limit ?? cities.length;
    return { cities: cities.slice(0, limit) };
  }

  /**
   * Distinct `locationType` values that have at least one active row (for filters / discovery).
   */
  async listLocationTypesPublic(): Promise<{ locationTypes: string[] }> {
    try {
      const raw = await this.locationsRepository
        .createQueryBuilder('l')
        .select('DISTINCT l.locationType', 'locationType')
        .where('l.isActive = :active', { active: true })
        .andWhere('l.locationType IS NOT NULL')
        .andWhere("TRIM(l.locationType) != ''")
        .getRawMany<{ locationType: string }>();
      const set = new Set<string>();
      for (const row of raw) {
        const t = row.locationType?.trim();
        if (t) set.add(t);
      }
      const locationTypes = Array.from(set).sort((a, b) => a.localeCompare(b));
      return { locationTypes };
    } catch (error: unknown) {
      if (this.isSchemaMismatchError(error)) {
        throw new ServiceUnavailableException(
          'Business locations schema is out of date. Run latest database migrations and retry.',
        );
      }
      throw error;
    }
  }

  /**
   * Filter public locations by optional cities / locationType, and optionally
   * `bookingStatus=unbooked` with `date` + `startTime`/`endTime` (HH:mm, supports crossing midnight).
   */
  async searchLocationsPublic(dto: SearchLocationsQueryDto) {
    const rows = await this.listAllLocationsPublic();
    let filtered = rows.filter((r) => r.isActive);

    const citySet = this.parseCitiesFilter(dto.cities);
    if (citySet) {
      filtered = filtered.filter((r) => {
        const c = r.city?.trim().toLowerCase();
        return Boolean(c && citySet.has(c));
      });
    }

    if (dto.locationType?.trim()) {
      const want = dto.locationType.trim().toLowerCase();
      filtered = filtered.filter(
        (r) => (r.locationType ?? '').trim().toLowerCase() === want,
      );
    }

    if (dto.bookingStatus !== 'unbooked') {
      return filtered;
    }

    const date = dto.date as string;
    const reqStart = this.hhMmToMinutes(dto.startTime as string);
    const reqEnd = this.hhMmToMinutes(dto.endTime as string);
    if (reqEnd === reqStart) {
      throw new BadRequestException('endTime must be different from startTime');
    }

    const busyKeys = await this.loadBusyCourtKeysForWindow(date, reqStart, reqEnd);
    const locationIds = filtered.map((r) => r.id);
    if (locationIds.length === 0) {
      return [];
    }

    const courtsByLocation = await this.loadCourtKeysByLocationId(locationIds);

    return filtered.filter((loc) => {
      const courts = courtsByLocation.get(loc.id) ?? [];
      if (courts.length === 0) {
        return false;
      }
      return courts.some((key) => !busyKeys.has(key));
    });
  }

  private parseCitiesFilter(cities?: string): Set<string> | null {
    if (!cities?.trim()) {
      return null;
    }
    const parts = cities
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return parts.length ? new Set(parts) : null;
  }

  private hhMmToMinutes(t: string): number {
    const [h, m] = t.split(':').map((x) => Number.parseInt(x, 10));
    return h * 60 + m;
  }

  private addDaysToIsoDate(date: string, days: number): string {
    const [year, month, day] = date.split('-').map((x) => Number.parseInt(x, 10));
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    utcDate.setUTCDate(utcDate.getUTCDate() + days);
    const yyyy = utcDate.getUTCFullYear().toString().padStart(4, '0');
    const mm = (utcDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = utcDate.getUTCDate().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private splitWindowToDaySegments(
    startMin: number,
    endMin: number,
  ): Array<{ dayOffset: 0 | 1; startMin: number; endMin: number }> {
    if (startMin === endMin) {
      return [];
    }
    if (endMin > startMin) {
      return [{ dayOffset: 0, startMin, endMin }];
    }
    return [
      { dayOffset: 0, startMin, endMin: 24 * 60 },
      { dayOffset: 1, startMin: 0, endMin },
    ];
  }

  private intervalsOverlapMinutes(
    aStart: number,
    aEnd: number,
    bStart: number,
    bEnd: number,
  ): boolean {
    return aStart < bEnd && aEnd > bStart;
  }

  private async loadBusyCourtKeysForWindow(
    date: string,
    reqStartMin: number,
    reqEndMin: number,
  ): Promise<Set<string>> {
    const reqSegments = this.splitWindowToDaySegments(reqStartMin, reqEndMin);
    const queryDates =
      reqSegments.length > 1 ? [date, this.addDaysToIsoDate(date, 1)] : [date];
    const dayOffsetByDate = new Map<string, 0 | 1>([
      [date, 0],
      ...(queryDates.length > 1
        ? ([[queryDates[1], 1]] as Array<[string, 0 | 1]>)
        : []),
    ]);

    const items = await this.bookingItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.booking', 'booking')
      .where('booking.bookingDate IN (:...dates)', { dates: queryDates })
      .andWhere('booking.bookingStatus != :c', { c: 'cancelled' })
      .andWhere('item.itemStatus != :ic', { ic: 'cancelled' })
      .select([
        'booking.bookingDate AS bookingDate',
        'item.courtKind AS courtKind',
        'item.courtId AS courtId',
        'item.startTime AS startTime',
        'item.endTime AS endTime',
      ])
      .getRawMany<{
        bookingDate: string;
        courtKind: string;
        courtId: string;
        startTime: string;
        endTime: string;
      }>();

    const busy = new Set<string>();
    for (const item of items) {
      const bookingDate = item.bookingDate;
      if (!bookingDate) {
        continue;
      }
      const bookingDayOffset = dayOffsetByDate.get(bookingDate);
      if (bookingDayOffset === undefined) {
        continue;
      }

      const bookingSegments = this.splitWindowToDaySegments(
        this.hhMmToMinutes(item.startTime),
        this.hhMmToMinutes(item.endTime),
      );
      for (const requestSegment of reqSegments) {
        if (requestSegment.dayOffset !== bookingDayOffset) {
          continue;
        }
        const hasOverlap = bookingSegments.some(
          (bookingSegment) =>
            bookingSegment.dayOffset === requestSegment.dayOffset &&
            this.intervalsOverlapMinutes(
              requestSegment.startMin,
              requestSegment.endMin,
              bookingSegment.startMin,
              bookingSegment.endMin,
            ),
        );
        if (hasOverlap) {
          busy.add(`${item.courtKind}:${item.courtId}`);
          break;
        }
      }
    }
    return busy;
  }

  private async loadCourtKeysByLocationId(
    locationIds: string[],
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, Set<string>>();
    const push = (locId: string | null | undefined, kind: string, id: string) => {
      if (!locId) {
        return;
      }
      const key = `${kind}:${id}`;
      const list = map.get(locId) ?? new Set<string>();
      list.add(key);
      map.set(locId, list);
    };

    if (locationIds.length === 0) {
      return new Map<string, string[]>();
    }

    const whereLoc = { businessLocationId: In(locationIds) };

    const [turf, futsal, padel, cricket] = await Promise.all([
      this.turfCourtRepository.find({
        where: { ...whereLoc, courtStatus: 'active' },
        select: ['id', 'businessLocationId'],
      }),
      this.futsalFieldRepository.find({
        where: { ...whereLoc, isActive: true },
        select: ['id', 'businessLocationId'],
      }),
      this.padelCourtRepository.find({
        where: { ...whereLoc, isActive: true, courtStatus: 'active' },
        select: ['id', 'businessLocationId'],
      }),
      this.cricketIndoorCourtRepository.find({
        where: { ...whereLoc, isActive: true },
        select: ['id', 'businessLocationId'],
      }),
    ]);

    for (const row of turf) {
      push(row.businessLocationId, 'turf_court', row.id);
    }
    for (const row of futsal) {
      push(row.businessLocationId, 'futsal_field', row.id);
    }
    for (const row of padel) {
      push(row.businessLocationId, 'padel_court', row.id);
    }
    for (const row of cricket) {
      push(row.businessLocationId, 'cricket_indoor_court', row.id);
    }

    const out = new Map<string, string[]>();
    for (const [locId, keys] of map.entries()) {
      out.set(locId, Array.from(keys));
    }
    return out;
  }

  /**
   * Ensures the location exists and its business tenant matches `tenantId`
   * (for arena courts and other tenant-scoped children).
   */
  async assertLocationBelongsToTenant(
    locationId: string,
    tenantId: string,
  ): Promise<BusinessLocation> {
    const loc = await this.locationsRepository.findOne({
      where: { id: locationId },
      relations: { business: true },
    });
    if (!loc?.business) {
      throw new NotFoundException(`Location ${locationId} not found`);
    }
    if (loc.business.tenantId !== tenantId) {
      throw new ForbiddenException(
        'Location does not belong to the active tenant',
      );
    }
    return loc;
  }

  async createLocation(
    requesterUserId: string,
    dto: CreateBusinessLocationDto,
  ): Promise<BusinessLocation> {
    let business: Business | null;
    try {
      business = await this.businessesRepository.findOne({
        where: { id: dto.businessId },
      });
    } catch (error: unknown) {
      if (this.isBusinessSchemaMismatchError(error)) {
        throw new ServiceUnavailableException(
          'Businesses schema is out of date. Run latest database migrations and retry.',
        );
      }
      throw error;
    }
    if (!business) {
      throw new NotFoundException(`Business ${dto.businessId} not found`);
    }
    const isPlatformOwner = await this.iamService.hasAnyRole(requesterUserId, [
      'platform-owner',
    ]);
    if (!isPlatformOwner) {
      const member = await this.membershipsRepository.findOne({
        where: { businessId: dto.businessId, userId: requesterUserId },
      });
      if (!member) {
        throw new ForbiddenException(
          'You cannot add locations to this business',
        );
      }
    }
    const sourceName = dto.branchName ?? dto.name ?? 'Unnamed Branch';
    const sourceAddress =
      dto.location?.addressLine ?? dto.location?.address ?? dto.addressLine;
    const sourceCity = dto.location?.city ?? dto.city;
    const sourceArea = dto.location?.area ?? dto.area;
    const sourceCountry = dto.location?.country ?? dto.country;
    const sourcePhone = dto.contact?.phone ?? dto.phone;
    const sourceManager = dto.contact?.manager ?? dto.manager;
    const sourceTimezone = dto.settings?.timezone ?? dto.timezone;
    const sourceCurrency = dto.settings?.currency ?? dto.currency;
    const sourceLatitude = normalizeCoordinateForPersist(
      dto.location?.coordinates?.lat ?? dto.latitude,
    );
    const sourceLongitude = normalizeCoordinateForPersist(
      dto.location?.coordinates?.lng ?? dto.longitude,
    );
    const { status: nextStatus, isActive: nextIsActive } =
      this.normalizeLocationStatus(dto.status);
    const logoTrimmed = dto.logo?.trim();
    const bannerImageTrimmed = dto.bannerImage?.trim();
    const galleryList =
      dto.gallery === undefined
        ? []
        : dto.gallery.map((u) => u.trim()).filter((u) => u.length > 0);

    const rawDetails = dto.details ?? dto.location?.details;
    const detailsValue =
      rawDetails !== undefined
        ? (() => {
            const t = rawDetails.trim();
            return t.length > 0 ? t : null;
          })()
        : null;

    const row = this.locationsRepository.create({
      businessId: dto.businessId,
      locationType: dto.locationType ?? 'arena',
      facilityTypes: dto.facilityTypes?.length ? dto.facilityTypes : [],
      name: sourceName,
      addressLine: sourceAddress,
      details: detailsValue,
      city: sourceCity,
      area: sourceArea,
      country: sourceCountry,
      latitude: sourceLatitude,
      longitude: sourceLongitude,
      phone: sourcePhone,
      manager: sourceManager,
      workingHours: dto.workingHours,
      timezone: sourceTimezone,
      currency: sourceCurrency ?? 'PKR',
      logo: logoTrimmed && logoTrimmed.length > 0 ? logoTrimmed : null,
      bannerImage:
        bannerImageTrimmed && bannerImageTrimmed.length > 0
          ? bannerImageTrimmed
          : null,
      gallery: galleryList,
      status: nextStatus,
      isActive: nextIsActive,
    });
    return this.locationsRepository.save(row);
  }

  async updateBusiness(
    requesterUserId: string,
    businessId: string,
    dto: UpdateBusinessDto,
  ): Promise<Business> {
    let business: Business | null;
    try {
      business = await this.businessesRepository.findOne({
        where: { id: businessId },
      });
    } catch (error: unknown) {
      if (this.isBusinessSchemaMismatchError(error)) {
        throw new ServiceUnavailableException(
          'Businesses schema is out of date. Run latest database migrations and retry.',
        );
      }
      throw error;
    }
    if (!business) {
      throw new NotFoundException(`Business ${businessId} not found`);
    }

    const isPlatformOwner = await this.iamService.hasAnyRole(requesterUserId, [
      'platform-owner',
    ]);
    if (!isPlatformOwner) {
      const member = await this.membershipsRepository.findOne({
        where: { businessId, userId: requesterUserId },
      });
      if (!member) {
        throw new ForbiddenException('You cannot update this business');
      }
    }

    if (dto.businessName && dto.businessName !== business.businessName) {
      let duplicate: Business | null;
      try {
        duplicate = await this.businessesRepository.findOne({
          where: { businessName: dto.businessName },
        });
      } catch (error: unknown) {
        if (this.isBusinessSchemaMismatchError(error)) {
          throw new ServiceUnavailableException(
            'Businesses schema is out of date. Run latest database migrations and retry.',
          );
        }
        throw error;
      }
      if (duplicate && duplicate.id !== businessId) {
        throw new BadRequestException(
          `Business ${dto.businessName} already exists in onboarding store`,
        );
      }
      business.businessName = dto.businessName;
    }
    if (dto.legalName !== undefined) {
      business.legalName = dto.legalName;
    }
    if (dto.businessType !== undefined) {
      business.businessType = dto.businessType;
    }
    if (dto.sportsOffered !== undefined) {
      business.sportsOffered = dto.sportsOffered;
    }
    if (dto.owner !== undefined) {
      business.owner = dto.owner;
    }
    if (dto.subscription !== undefined) {
      business.subscription = dto.subscription;
    }
    if (dto.settings !== undefined) {
      business.settings = dto.settings;
    }
    if (dto.status !== undefined) {
      business.status = dto.status;
    }

    try {
      return await this.businessesRepository.save(business);
    } catch (error: unknown) {
      if (this.isBusinessSchemaMismatchError(error)) {
        throw new ServiceUnavailableException(
          'Businesses schema is out of date. Run latest database migrations and retry.',
        );
      }
      throw error;
    }
  }

  async updateLocation(
    requesterUserId: string,
    locationId: string,
    dto: UpdateBusinessLocationDto,
  ): Promise<BusinessLocation> {
    const location = await this.locationsRepository.findOne({
      where: { id: locationId },
    });
    if (!location) {
      throw new NotFoundException(`Location ${locationId} not found`);
    }

    const isPlatformOwner = await this.iamService.hasAnyRole(requesterUserId, [
      'platform-owner',
    ]);
    if (!isPlatformOwner) {
      const member = await this.membershipsRepository.findOne({
        where: { businessId: location.businessId, userId: requesterUserId },
      });
      if (!member) {
        throw new ForbiddenException('You cannot update this location');
      }
    }

    if (dto.name !== undefined || dto.branchName !== undefined) {
      location.name = dto.branchName ?? dto.name ?? location.name;
    }
    if (dto.locationType !== undefined) location.locationType = dto.locationType;
    if (dto.facilityTypes !== undefined) location.facilityTypes = dto.facilityTypes;
    if (
      dto.addressLine !== undefined ||
      dto.location?.addressLine !== undefined ||
      dto.location?.address !== undefined
    ) {
      location.addressLine =
        dto.location?.addressLine ?? dto.location?.address ?? dto.addressLine;
    }
    if (dto.details !== undefined || dto.location?.details !== undefined) {
      const next =
        dto.details !== undefined ? dto.details : dto.location?.details;
      if (next !== undefined) {
        const t = next.trim();
        location.details = t.length > 0 ? t : null;
      }
    }
    if (dto.city !== undefined || dto.location?.city !== undefined) {
      location.city = dto.location?.city ?? dto.city;
    }
    if (dto.area !== undefined || dto.location?.area !== undefined) {
      location.area = dto.location?.area ?? dto.area;
    }
    if (dto.country !== undefined || dto.location?.country !== undefined) {
      location.country = dto.location?.country ?? dto.country;
    }
    if (
      dto.latitude !== undefined ||
      dto.location?.coordinates?.lat !== undefined
    ) {
      const next = normalizeCoordinateForPersist(
        dto.location?.coordinates?.lat ?? dto.latitude,
      );
      if (next !== undefined) {
        location.latitude = next;
      }
    }
    if (
      dto.longitude !== undefined ||
      dto.location?.coordinates?.lng !== undefined
    ) {
      const next = normalizeCoordinateForPersist(
        dto.location?.coordinates?.lng ?? dto.longitude,
      );
      if (next !== undefined) {
        location.longitude = next;
      }
    }
    if (dto.phone !== undefined || dto.contact?.phone !== undefined) {
      location.phone = dto.contact?.phone ?? dto.phone;
    }
    if (dto.manager !== undefined || dto.contact?.manager !== undefined) {
      location.manager = dto.contact?.manager ?? dto.manager;
    }
    if (dto.workingHours !== undefined) location.workingHours = dto.workingHours;
    if (dto.timezone !== undefined || dto.settings?.timezone !== undefined) {
      location.timezone = dto.settings?.timezone ?? dto.timezone;
    }
    if (dto.currency !== undefined || dto.settings?.currency !== undefined) {
      const nextCurrency = dto.settings?.currency ?? dto.currency;
      if (nextCurrency !== undefined) {
        location.currency = nextCurrency;
      }
    }
    if (dto.logo !== undefined) {
      const t = dto.logo.trim();
      location.logo = t.length > 0 ? t : null;
    }
    if (dto.bannerImage !== undefined) {
      const t = dto.bannerImage.trim();
      location.bannerImage = t.length > 0 ? t : null;
    }
    if (dto.gallery !== undefined) {
      location.gallery = dto.gallery
        .map((u) => u.trim())
        .filter((u) => u.length > 0);
    }
    if (dto.status !== undefined) {
      const { status, isActive } = this.normalizeLocationStatus(dto.status);
      location.status = status;
      location.isActive = isActive;
    }

    return this.locationsRepository.save(location);
  }

  async deleteBusiness(
    requesterUserId: string,
    businessId: string,
  ): Promise<{ deleted: true; businessId: string }> {
    let business: Business | null;
    try {
      business = await this.businessesRepository.findOne({
        where: { id: businessId },
      });
    } catch (error: unknown) {
      if (this.isBusinessSchemaMismatchError(error)) {
        throw new ServiceUnavailableException(
          'Businesses schema is out of date. Run latest database migrations and retry.',
        );
      }
      throw error;
    }
    if (!business) {
      throw new NotFoundException(`Business ${businessId} not found`);
    }

    const isPlatformOwner = await this.iamService.hasAnyRole(requesterUserId, [
      'platform-owner',
    ]);
    if (!isPlatformOwner) {
      const member = await this.membershipsRepository.findOne({
        where: { businessId, userId: requesterUserId },
      });
      if (!member) {
        throw new ForbiddenException('You cannot delete this business');
      }
    }

    await this.businessesRepository.delete({ id: businessId });
    return { deleted: true, businessId };
  }

  async deleteLocation(
    requesterUserId: string,
    locationId: string,
  ): Promise<{ deleted: true; locationId: string }> {
    const location = await this.locationsRepository.findOne({
      where: { id: locationId },
    });
    if (!location) {
      throw new NotFoundException(`Location ${locationId} not found`);
    }

    const isPlatformOwner = await this.iamService.hasAnyRole(requesterUserId, [
      'platform-owner',
    ]);
    if (!isPlatformOwner) {
      const member = await this.membershipsRepository.findOne({
        where: { businessId: location.businessId, userId: requesterUserId },
      });
      if (!member) {
        throw new ForbiddenException('You cannot delete this location');
      }
    }

    await this.locationsRepository.delete({ id: locationId });
    return { deleted: true, locationId };
  }

  /**
   * Map/list pin payload for end-user apps (filters + sidebar + map markers).
   */
  toVenueMapMarker(
    row: Awaited<
      ReturnType<BusinessesService['listAllLocationsPublic']>
    >[number],
  ): {
    venueId: string;
    name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    logo: string | null;
    bannerImage: string | null;
  } {
    return {
      venueId: row.id,
      name: row.name,
      address: row.addressLine ?? '',
      latitude: row.latitude,
      longitude: row.longitude,
      logo: row.logo,
      bannerImage: row.bannerImage,
    };
  }

  /**
   * Markers for one category: `all` (every active venue), `gaming`, or `FutsalArenas`.
   */
  async listVenueMarkersPublic(
    category: 'all' | 'gaming' | 'FutsalArenas',
  ): Promise<
    Array<{
      venueId: string;
      name: string;
      address: string;
      latitude: number | null;
      longitude: number | null;
      logo: string | null;
      bannerImage: string | null;
    }>
  > {
    const rows = await this.listAllLocationsPublic();
    const active = rows.filter((r) => r.isActive);
    if (category === 'all') {
      return active.map((r) => this.toVenueMapMarker(r));
    }
    if (category === 'gaming') {
      const picked = active.filter((r) => {
        const t = (r.locationType ?? '').trim().toLowerCase();
        return (
          t === 'gaming' ||
          t === 'gaming-zone' ||
          t.includes('gaming')
        );
      });
      return picked.map((r) => this.toVenueMapMarker(r));
    }
    const picked = active.filter(
      (r) =>
        (r.facilityCounts['futsal-field'] ?? 0) > 0 ||
        (r.facilityCounts['turf-court'] ?? 0) > 0,
    );
    return picked.map((r) => this.toVenueMapMarker(r));
  }

  private facilityCountsToAvailableList(
    counts: Record<
      'padel-court' | 'futsal-field' | 'cricket-indoor' | 'turf-court',
      number
    >,
  ): Array<{ label: string; count: number }> {
    const labels: Record<string, string> = {
      'padel-court': 'Padel Court',
      'futsal-field': 'Futsal',
      'cricket-indoor': 'Cricket',
      'turf-court': 'Turf',
    };
    const out: Array<{ label: string; count: number }> = [];
    for (const key of [
      'padel-court',
      'futsal-field',
      'cricket-indoor',
      'turf-court',
    ] as const) {
      const n = counts[key] ?? 0;
      if (n > 0) {
        out.push({ label: labels[key], count: n });
      }
    }
    return out;
  }

  /** Public venue screen: gallery, club info, facilities, hours, booking hints. */
  async getVenueDetailsPublic(locationId: string) {
    let loc: BusinessLocation | null;
    try {
      loc = await this.locationsRepository.findOne({
        where: { id: locationId },
      });
    } catch (error: unknown) {
      if (this.isSchemaMismatchError(error)) {
        throw new ServiceUnavailableException(
          'Business locations schema is out of date. Run latest database migrations and retry.',
        );
      }
      throw error;
    }
    if (!loc) {
      throw new NotFoundException(`Venue ${locationId} not found`);
    }

    let business: Business | null;
    try {
      business = await this.businessesRepository.findOne({
        where: { id: loc.businessId },
      });
    } catch (error: unknown) {
      if (this.isBusinessSchemaMismatchError(error)) {
        throw new ServiceUnavailableException(
          'Businesses schema is out of date. Run latest database migrations and retry.',
        );
      }
      throw error;
    }

    const businessById = new Map<string, Business>();
    if (business) {
      businessById.set(business.id, business);
    }
    const rows = await this.buildLocationListRowsWithFacilityInfo(
      [loc],
      businessById,
    );
    const row = rows[0];

    return {
      venueId: row.id,
      name: row.name,
      address: row.addressLine ?? '',
      latitude: row.latitude,
      longitude: row.longitude,
      logo: row.logo,
      bannerImage: row.bannerImage,
      gallery: row.gallery ?? [],
      clubDetails: {
        businessName: business?.businessName ?? null,
        description: row.details,
        sportsOffered: business?.sportsOffered ?? [],
      },
      currency: row.currency,
      price: null as number | null,
      packages: [] as unknown[],
      availability: {
        tenantId: business?.tenantId ?? null,
        note:
          'Use GET /bookings/courts/{courtKind}/{courtId}/slot-grid with X-Tenant-Id for live slots.',
      },
      dailyOpenHours: row.workingHours ?? null,
      facilityAvailable: this.facilityCountsToAvailableList(row.facilityCounts),
      tenantId: business?.tenantId ?? null,
    };
  }
}
