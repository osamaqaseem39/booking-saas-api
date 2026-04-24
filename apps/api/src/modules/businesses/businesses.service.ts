import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PadelCourt } from '../arena/padel-court/entities/padel-court.entity';
import { TurfCourt } from '../arena/turf/entities/turf-court.entity';
import { GamingStation } from '../arena/gaming-station/entities/gaming-station.entity';
import { BookingItem } from '../bookings/entities/booking-item.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { IamService } from '../iam/iam.service';
import { CreateBusinessLocationDto } from './dto/create-business-location.dto';
import { CreateBusinessDto } from './dto/create-business.dto';
import { ListLocationCitiesDto } from './dto/list-location-cities.dto';
import { GetVenuesAllQueryDto } from './dto/get-venues-all-query.dto';
import { TurfPricingConfig } from '../arena/turf/turf.types';
import { SearchLocationsQueryDto } from './dto/search-locations-query.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpdateBusinessLocationDto } from './dto/update-business-location.dto';
import { BusinessLocation } from './entities/business-location.entity';
import { Business } from './entities/business.entity';
import { BusinessMembership } from './entities/business-membership.entity';
import {
  BUSINESS_LOCATION_TYPE_CODES,
  normalizeLocationFacilityTypesForApi,
  normalizeLocationFacilityTypesForPersist,
} from './constants/business-location.constants';
import {
  bookingDateWindow,
  bookingInDateWindow,
  colorForIndex,
  currencyLabel,
  customerSourceKey,
  formatStatChange,
  greetingTimeLabelKarachi,
  parseDashboardPeriod,
  previousWindowForDelta,
  sportIcon,
  sportLabel,
  todayYmdKarachi,
} from './utils/dashboard-analytics.util';

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
    @InjectRepository(PadelCourt)
    private readonly padelCourtRepository: Repository<PadelCourt>,
    @InjectRepository(TurfCourt)
    private readonly turfCourtRepository: Repository<TurfCourt>,
    @InjectRepository(GamingStation)
    private readonly gamingStationRepository: Repository<GamingStation>,
    @InjectRepository(BookingItem)
    private readonly bookingItemRepository: Repository<BookingItem>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
  ) {}

  async listForRequester(requesterUserId: string) {
    const businesses = await this.businessesRepository.find({
      order: { createdAt: 'DESC' },
    });
    const memberships = await this.membershipsRepository.find();
    const isPlatformOwner = await this.iamService.hasAnyRole(requesterUserId, [
      'platform-owner',
    ]);
    
    // Also consider location-admin roles to find businesses
    const constraint = await this.iamService.getLocationAdminConstraint(requesterUserId);
    let allowedBusinessIds = new Set<string>();
    if (constraint) {
      const loc = await this.locationsRepository.findOne({ where: { id: constraint } });
      if (loc) {
        allowedBusinessIds.add(loc.businessId);
      }
    }

    const scoped = isPlatformOwner
      ? businesses
      : businesses.filter(
          (b) =>
            memberships.some(
              (m) => m.businessId === b.id && m.userId === requesterUserId,
            ) || allowedBusinessIds.has(b.id),
        );
    return scoped.map((business) => ({
      ...business,
      memberships: memberships.filter(
        (membership) => membership.businessId === business.id,
      ),
    }));
  }

  async getDashboardView(requesterUserId: string, periodParam?: string) {
    const period = parseDashboardPeriod(periodParam);
    const refToday = todayYmdKarachi();
    const win = bookingDateWindow(period, refToday);
    const winPrev = previousWindowForDelta(period, refToday);

    const businesses = await this.listForRequester(requesterUserId);
    const businessIds = businesses.map((b) => b.id);
    const tenantIds = businesses.map((b) => b.tenantId);
    
    const constraint = await this.iamService.getLocationAdminConstraint(requesterUserId);

    let locations = await this.locationsRepository.find({
      where: { businessId: In(businessIds) },
      select: ['id', 'businessId', 'currency'],
    });

    if (constraint) {
      locations = locations.filter(l => l.id === constraint);
    }
    
    const locIds = locations.map((l) => l.id);
    const displayCurrency = locations[0]?.currency
      ? currencyLabel(locations[0]!.currency)
      : 'Rs.';
    const locCurrency = locations[0]?.currency || 'PKR';
    
    const padelCourts = locIds.length
      ? await this.padelCourtRepository.find({
          where: { businessLocationId: In(locIds), courtStatus: 'active', isActive: true },
          select: ['id', 'businessLocationId'],
        })
      : [];
    const turfCourts = locIds.length
      ? await this.turfCourtRepository.find({
          where: { branchId: In(locIds), status: 'active' },
          select: ['id', 'branchId'],
        })
      : [];
    const gamingStations = locIds.length
      ? await this.gamingStationRepository.find({
          where: { businessLocationId: In(locIds), unitStatus: 'active', isActive: true },
          select: ['id', 'businessLocationId'],
        })
      : [];

    const courts = [
      ...padelCourts,
      ...turfCourts.map(c => ({ id: c.id, businessLocationId: c.branchId })),
      ...gamingStations
    ];

    // Fetch bookings for these tenants
    let bookings = tenantIds.length 
      ? await this.bookingRepository.find({
          where: { tenantId: In(tenantIds) },
          relations: ['items'],
        })
      : [];
    
    if (constraint) {
      const allowedCourtIds = new Set(courts.map(c => c.id));
      bookings = bookings.filter(b => b.items?.some(i => allowedCourtIds.has(i.courtId)));
    }

    const locationBusinessMap = new Map(locations.map((l) => [l.id, l.businessId]));
    const courtCountByBusiness = new Map<string, number>();
    for (const c of courts) {
      const bId = locationBusinessMap.get(c.businessLocationId ?? '');
      if (!bId) continue;
      courtCountByBusiness.set(bId, (courtCountByBusiness.get(bId) ?? 0) + 1);
    }

    const windowBookings =
      period === 'all'
        ? bookings
        : bookings.filter((b) => bookingInDateWindow(b.bookingDate, win));
    const prevWindowBookings =
      period === 'all'
        ? []
        : bookings.filter((b) => bookingInDateWindow(b.bookingDate, winPrev));

    const foldTenant = (rows: typeof bookings) => {
      const statsByTenant = new Map<string, {
        count: number
        confirmed: number
        pending: number
        cancelled: number
        completed: number
        revenue: number
        paid: number
      }>();
      for (const b of rows) {
        const s = statsByTenant.get(b.tenantId) ?? {
          count: 0, confirmed: 0, pending: 0, cancelled: 0, completed: 0, revenue: 0, paid: 0
        };
        s.count += 1;
        if (b.bookingStatus === 'confirmed') s.confirmed += 1;
        if (b.bookingStatus === 'pending') s.pending += 1;
        if (b.bookingStatus === 'cancelled') s.cancelled += 1;
        if (b.bookingStatus === 'completed') s.completed += 1;
        const total = Number(b.totalAmount ?? 0);
        s.revenue += total;
        if (b.paymentStatus === 'paid') s.paid += total;
        statsByTenant.set(b.tenantId, s);
      }
      return statsByTenant;
    };

    const statsByTenant = foldTenant(windowBookings);
    const prevStatsByTenant = foldTenant(prevWindowBookings);

    const totalStats = {
      courtCount: courts.length,
      bookingCount: windowBookings.length,
      confirmedBookingCount: windowBookings.filter(b => b.bookingStatus === 'confirmed').length,
      pendingBookingCount: windowBookings.filter(b => b.bookingStatus === 'pending').length,
      cancelledBookingCount: windowBookings.filter(b => b.bookingStatus === 'cancelled').length,
      completedBookingCount: windowBookings.filter(b => b.bookingStatus === 'completed').length,
      revenueTotal: windowBookings.reduce((acc, b) => acc + Number(b.totalAmount ?? 0), 0),
      revenuePaid: windowBookings.filter(b => b.paymentStatus === 'paid').reduce((acc, b) => acc + Number(b.totalAmount ?? 0), 0),
    };

    const countKpis = (rows: typeof bookings) => {
      return {
        upcoming: rows.filter(
          (b) => b.bookingStatus === 'confirmed' && b.bookingDate >= refToday,
        ).length,
        pending: rows.filter((b) => b.bookingStatus === 'pending').length,
        completed: rows.filter((b) => b.bookingStatus === 'completed').length,
        canceled: rows.filter((b) => b.bookingStatus === 'cancelled').length,
      };
    };
    const curK = countKpis(windowBookings);
    const prevK = countKpis(prevWindowBookings);

    const sportRevenue = new Map<string, number>();
    const sportCount = new Map<string, number>();
    const sourceCount = new Map<string, number>();
    for (const b of windowBookings) {
      const st = String(b.sportType || 'other').toLowerCase();
      const amt = Number(b.totalAmount ?? 0);
      sportRevenue.set(st, (sportRevenue.get(st) ?? 0) + amt);
      sportCount.set(st, (sportCount.get(st) ?? 0) + 1);
      const sk = customerSourceKey({
        sportType: b.sportType,
        paymentMethod: b.paymentMethod,
      });
      sourceCount.set(sk, (sourceCount.get(sk) ?? 0) + 1);
    }
    const revSum = totalStats.revenueTotal || 0;
    const bookSum = totalStats.bookingCount || 0;

    const sportKeys = [...sportRevenue.keys()].sort(
      (a, b) => (sportRevenue.get(b) ?? 0) - (sportRevenue.get(a) ?? 0),
    );
    const revenueBySport = sportKeys.map((k) => {
      const amount = Math.round((sportRevenue.get(k) ?? 0) * 100) / 100;
      return {
        sport: sportLabel(k),
        amount,
        icon: sportIcon(k),
        percentageOfRevenue: revSum > 0 ? Math.round(((sportRevenue.get(k) ?? 0) / revSum) * 1000) / 10 : 0,
      };
    });
    const bookingsBySport = sportKeys.map((k) => {
      const c = sportCount.get(k) ?? 0;
      return {
        sport: sportLabel(k),
        count: c,
        icon: sportIcon(k),
        percentageOfTotal: bookSum > 0 ? Math.round((c / bookSum) * 1000) / 10 : 0,
      };
    });

    const sourceRows = [...sourceCount.entries()]
      .map(([source, count]) => ({ source, count, pct: bookSum > 0 ? (count / bookSum) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);
    const maxSources = 5;
    const top = sourceRows.slice(0, maxSources);
    const rest = sourceRows.slice(maxSources);
    const restCount = rest.reduce((a, r) => a + r.count, 0);
    const customersBySource: Array<{
      source: string
      count: number
      percentage: number
      color: string
    }> = top.map((r, i) => ({
      source: r.source,
      count: r.count,
      percentage: bookSum > 0 ? Math.round(r.pct * 10) / 10 : 0,
      color: colorForIndex(i),
    }));
    if (restCount > 0) {
      customersBySource.push({
        source: 'Others',
        count: restCount,
        percentage: bookSum > 0 ? Math.round((restCount / bookSum) * 1000) / 10 : 0,
        color: colorForIndex(maxSources),
      });
    }

    const performanceSummary =
      period === 'today'
        ? "Here's your arena performance for today"
        : period === 'last7days'
          ? "Here's your performance over the last 7 days"
          : period === 'thisMonth'
            ? "Month to date at your business locations"
            : "All-time performance at your business locations";

    const { part: greetPart } = greetingTimeLabelKarachi();
    let firstName = 'There';
    try {
      const me = await this.iamService.getMe(requesterUserId);
      const fn = String(me?.fullName || 'there').trim().split(/\s+/)[0] || 'There';
      firstName = fn;
    } catch {
      firstName = 'There';
    }
    const greeting = `GOOD ${greetPart}, ${firstName.toUpperCase()}`;

    return {
      generatedAt: new Date().toISOString(),
      period: { key: period, window: win, refToday, previousWindow: winPrev },
      scope: { businessCount: businesses.length, locationCount: locations.length },
      greeting,
      performanceSummary,
      bookingStats: [
        { label: 'Upcoming', value: curK.upcoming, change: period === 'all' ? '0' : formatStatChange(curK.upcoming, prevK.upcoming) },
        { label: 'Completed', value: curK.completed, change: period === 'all' ? '0' : formatStatChange(curK.completed, prevK.completed) },
        { label: 'Canceled', value: curK.canceled, change: period === 'all' ? '0' : formatStatChange(curK.canceled, prevK.canceled) },
        { label: 'Pending', value: curK.pending, change: period === 'all' ? '0' : formatStatChange(curK.pending, prevK.pending) },
      ],
      revenueOverview: {
        total: Math.round(revSum * 100) / 100,
        currency: displayCurrency,
        currencyCode: locCurrency,
        revenueBySport,
        bookingsBySport,
      },
      customersBySource,
      totals: totalStats,
      businesses: businesses.map((b) => {
        const s = statsByTenant.get(b.tenantId);
        const sPrev = prevStatsByTenant.get(b.tenantId);
        return {
          businessId: b.id,
          tenantId: b.tenantId,
          businessName: b.businessName,
          status: b.status,
          locationCount: locations.filter((l) => l.businessId === b.id).length,
          courtCount: courtCountByBusiness.get(b.id) ?? 0,
          bookingCount: s?.count ?? 0,
          confirmedBookingCount: s?.confirmed ?? 0,
          pendingBookingCount: s?.pending ?? 0,
          cancelledBookingCount: s?.cancelled ?? 0,
          completedBookingCount: s?.completed ?? 0,
          revenueTotal: s?.revenue ?? 0,
          revenuePaid: s?.paid ?? 0,
          previousPeriod: period === 'all' ? null : {
            bookingCount: sPrev?.count ?? 0,
            revenueTotal: sPrev?.revenue ?? 0,
            completedBookingCount: sPrev?.completed ?? 0,
          },
        };
      }),
    };
  }

  async onboardBusiness(dto: CreateBusinessDto) {
    const duplicate = await this.businessesRepository.findOne({
      where: { businessName: dto.businessName },
    });
    if (duplicate) throw new BadRequestException(`Business ${dto.businessName} already exists`);

    const business = await this.businessesRepository.save(
      this.businessesRepository.create({
        tenantId: dto.tenantId ?? randomUUID(),
        businessName: dto.businessName,
        legalName: dto.legalName,
        owner: dto.owner,
        subscription: dto.subscription,
        settings: dto.settings,
        status: dto.status ?? 'active',
      }),
    );

    const adminSource = dto.admin
      ? dto.admin
      : dto.owner
        ? {
            fullName: dto.owner.name,
            email: dto.owner.email,
            phone: dto.owner.phone,
            password: dto.owner.password ?? `Tmp#${randomUUID().replace(/-/g, '').slice(0, 12)}`,
          }
        : null;

    if (!adminSource) return { business, adminUser: null, membership: null };
    const adminUser = await this.iamService.ensureUser(adminSource);
    await this.iamService.assignRole(adminUser.id, 'business-admin');
    const membership = await this.membershipsRepository.save(
      this.membershipsRepository.create({
        businessId: business.id,
        userId: adminUser.id,
        membershipRole: 'owner',
      }),
    );
    return { business, adminUser, membership };
  }

  async hasConsoleLocationListScope(userId: string): Promise<boolean> {
    return this.iamService.hasAnyRole(userId, [
      'platform-owner',
      'business-admin',
      'location-admin',
      'business-staff',
    ]);
  }

  async listLocationNameIdsPublic(nameFilter?: string | null) {
    const rows = await this.locationsRepository.find({ select: ['id', 'name'], order: { name: 'ASC' } });
    return { locations: this.filterLocationRowsByName(rows, nameFilter).map((r) => ({ id: r.id, name: r.name })) };
  }

  async listLocationNameIdsForConsole(requesterUserId: string, tenantIdFilter?: string | null, nameFilter?: string | null) {
    const rows = await this.listLocationsForConsole(requesterUserId, tenantIdFilter, nameFilter);
    return { locations: rows.map((r) => ({ id: r.id, name: r.name })) };
  }

  async listLocationsForRequester(requesterUserId: string) {
    const isPlatformOwner = await this.iamService.hasAnyRole(requesterUserId, [
      'platform-owner',
    ]);
    if (isPlatformOwner) return this.listAllLocationsPublic();

    const constraint = await this.iamService.getLocationAdminConstraint(requesterUserId);
    const all = await this.listAllLocationsPublic();
    
    if (constraint) {
      return all.filter((l) => l.id === constraint);
    }

    const businesses = await this.listForRequester(requesterUserId);
    const businessIds = businesses.map((b) => b.id);
    return all.filter((l) => businessIds.includes(l.businessId));
  }

  async listLocationsForConsole(requesterUserId: string, tenantIdFilter?: string | null, nameFilter?: string | null) {
    await this.iamService.assertRequesterActive(requesterUserId);
    let rows = await this.listLocationsForRequester(requesterUserId);
    if (tenantIdFilter?.trim()) {
      const tid = tenantIdFilter.trim();
      rows = rows.filter((r) => (r.business?.tenantId ?? '') === tid);
    }
    return this.filterLocationRowsByName(rows, nameFilter);
  }

  async listAllLocationsPublic(nameFilter?: string | null) {
    const locations = await this.locationsRepository.find({ order: { createdAt: 'DESC' } });
    const businesses = await this.businessesRepository.find();
    const businessById = new Map(businesses.map((b) => [b.id, b]));
    const locationIds = locations.map((l) => l.id);
    const [padelCourts, turfCourts, gamingStations] = locationIds.length
      ? await Promise.all([
          this.padelCourtRepository.find({
            where: {
              businessLocationId: In(locationIds),
              isActive: true,
              courtStatus: 'active',
            },
            select: ['id', 'name', 'businessLocationId', 'pricePerSlot'],
          }),
          this.turfCourtRepository.find({
            where: { branchId: In(locationIds), status: 'active' },
            select: ['id', 'name', 'branchId', 'pricing', 'supportedSports'],
          }),
          this.gamingStationRepository.find({
            where: {
              businessLocationId: In(locationIds),
              isActive: true,
              unitStatus: 'active',
            },
            select: ['id', 'name', 'businessLocationId', 'pricePerSlot'],
          }),
        ])
      : [[], [], []];

    const facilityCourtsByLocation = new Map<
      string,
      Array<{
        facilityType: 'padel' | 'turf' | 'gaming';
        id: string;
        name: string;
        price?: number;
        pricing?: TurfPricingConfig;
        supportedSports?: string[];
      }>
    >();
    

    for (const c of padelCourts) {
      const key = c.businessLocationId ?? '';
      const rows = facilityCourtsByLocation.get(key) ?? [];
      rows.push({
        facilityType: 'padel',
        id: c.id,
        name: c.name,
        price: parseFloat(c.pricePerSlot ?? '0'),
      });
      facilityCourtsByLocation.set(key, rows);
    }
    for (const c of turfCourts) {
      const key = c.branchId ?? '';
      const rows = facilityCourtsByLocation.get(key) ?? [];
      rows.push({
        facilityType: 'turf',
        id: c.id,
        name: c.name,
        price:
          c.pricing?.futsal?.basePrice ?? c.pricing?.cricket?.basePrice ?? 0,
        pricing: c.pricing,
        supportedSports: c.supportedSports,
      });
      facilityCourtsByLocation.set(key, rows);
    }
    for (const c of gamingStations) {
      const key = c.businessLocationId ?? '';
      const rows = facilityCourtsByLocation.get(key) ?? [];
      rows.push({
        facilityType: 'gaming',
        id: c.id,
        name: c.name,
        price: parseFloat(c.pricePerSlot ?? '0'),
      });
      facilityCourtsByLocation.set(key, rows);
    }

    const rows = locations.map((loc) => {
      const business = businessById.get(loc.businessId);
      const facilityCourts = facilityCourtsByLocation.get(loc.id) ?? [];
      const padelCount = facilityCourts.filter((f) => f.facilityType === 'padel').length;
      const turfCount = facilityCourts.filter((f) => f.facilityType === 'turf').length;
      const gamingCount = facilityCourts.filter((f) => f.facilityType === 'gaming').length;

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
        latitude: loc.latitude ?? null,
        longitude: loc.longitude ?? null,
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
        business: business
          ? { id: business.id, businessName: business.businessName, tenantId: business.tenantId }
          : null,
        facilityCounts: { padel: padelCount, turf: turfCount, gaming: gamingCount },
        facilityCourts,
        price: (() => {
          const prices = facilityCourts
            .map((f) => f.price)
            .filter((p): p is number => typeof p === 'number' && p > 0 && !isNaN(p));
          return prices.length > 0 ? Math.min(...prices) : 0;
        })(),
      };
    });
    return this.filterLocationRowsByName(rows, nameFilter);
  }

  async listLocationsWithFacilityCountsPublic() {
    return { locations: await this.listAllLocationsPublic() };
  }

  async listLocationCitiesPublic(dto: ListLocationCitiesDto): Promise<{ cities: string[] }> {
    const rows = await this.listAllLocationsPublic();
    const query = dto.q?.trim().toLowerCase();
    const set = new Set<string>();
    for (const r of rows) {
      const city = r.city?.trim();
      if (!city) continue;
      if (query && !city.toLowerCase().includes(query)) continue;
      set.add(city);
    }
    const cities = [...set].sort((a, b) => a.localeCompare(b));
    return { cities: cities.slice(0, dto.limit ?? cities.length) };
  }

  async listLocationTypesPublic(): Promise<{ locationTypes: string[] }> {
    const types = [...new Set((await this.locationsRepository.find({ select: ['locationType'] })).map((r) => r.locationType).filter(Boolean))];
    return { locationTypes: types.sort((a, b) => a.localeCompare(b)) };
  }

  async listAllRegisteredLocationTypesPublic(): Promise<{ locationTypes: string[] }> {
    const db = await this.listLocationTypesPublic();
    const set = new Set<string>([...BUSINESS_LOCATION_TYPE_CODES, ...db.locationTypes]);
    return { locationTypes: [...set].sort((a, b) => a.localeCompare(b)) };
  }

  async searchLocationsPublic(dto: SearchLocationsQueryDto) {
    let rows = (await this.listAllLocationsPublic()).filter((r) => r.isActive);
    if (dto.cities?.trim()) {
      const wanted = new Set(dto.cities.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean));
      rows = rows.filter((r) => wanted.has((r.city ?? '').trim().toLowerCase()));
    }
    if (dto.locationType?.trim()) {
      const t = dto.locationType.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.locationType ?? '').toLowerCase() === t ||
          (t === 'padel' && (r.facilityCounts.padel ?? 0) > 0) ||
          (t === 'turf' && (r.facilityCounts.turf ?? 0) > 0) ||
          ((t === 'futsal' || t === 'futsalarenas') &&
            (r.facilityCourts as any[]).some(
              (f) => f.facilityType === 'turf' && f.supportedSports?.includes('futsal'),
            )) ||
          (t === 'cricket' &&
            (r.facilityCourts as any[]).some(
              (f) => f.facilityType === 'turf' && f.supportedSports?.includes('cricket'),
            )) ||
          ((t === 'gaming' || t === 'gaming-zone') && (r.facilityCounts.gaming ?? 0) > 0),
      );
    }

    if (dto.bookingStatus === 'unbooked' && dto.date && dto.startTime && dto.endTime) {
      const busyKeys = await this.loadBusyCourtKeysForWindow(
        dto.date,
        this.hhMmToMinutes(dto.startTime),
        this.hhMmToMinutes(dto.endTime),
      );
      const locationIds = rows.map((r) => r.id);
      const courtsByLocation = await this.loadCourtKeysByLocationId(locationIds);

      rows = rows.filter((loc) => {
        const courts = courtsByLocation.get(loc.id) ?? [];
        if (courts.length === 0) return false;
        // If searching specifically for a type, we should only consider those courts
        const t = dto.locationType?.trim().toLowerCase();
        let relevant = courts;
        if (t === 'padel') {
          relevant = courts.filter((c) => c.startsWith('padel_court:'));
        } else if (t === 'turf' || t === 'futsal' || t === 'cricket') {
          relevant = courts.filter((c) => c.startsWith('turf_court:'));
        }
        if (relevant.length === 0) return false;
        return relevant.some((key) => !busyKeys.has(key));
      });
    }

    return rows.map((r) => this.toVenueMapMarker(r, dto.locationType));
  }

  async assertLocationBelongsToTenant(locationId: string, tenantId: string): Promise<BusinessLocation> {
    const loc = await this.locationsRepository.findOne({ where: { id: locationId }, relations: { business: true } });
    if (!loc?.business) throw new NotFoundException(`Location ${locationId} not found`);
    if (loc.business.tenantId !== tenantId) throw new ForbiddenException('Location does not belong to the active tenant');
    return loc;
  }

  async createLocation(requesterUserId: string, dto: CreateBusinessLocationDto): Promise<BusinessLocation> {
    await this.iamService.assertRequesterActive(requesterUserId);
    const business = await this.businessesRepository.findOne({ where: { id: dto.businessId } });
    if (!business) throw new NotFoundException(`Business ${dto.businessId} not found`);

    const row = this.locationsRepository.create({
      businessId: dto.businessId,
      locationType: dto.locationType,
      facilityTypes: normalizeLocationFacilityTypesForPersist(dto.facilityTypes ?? []),
      name: dto.branchName ?? dto.name ?? 'Unnamed Branch',
      addressLine: dto.location?.addressLine ?? dto.location?.address ?? dto.addressLine,
      details: (dto.details ?? dto.location?.details ?? '').trim() || null,
      city: dto.location?.city ?? dto.city,
      area: dto.location?.area ?? dto.area,
      country: dto.location?.country ?? dto.country,
      latitude: dto.location?.coordinates?.lat ?? dto.latitude,
      longitude: dto.location?.coordinates?.lng ?? dto.longitude,
      phone: dto.contact?.phone ?? dto.phone,
      manager: dto.contact?.manager ?? dto.manager,
      workingHours: dto.workingHours,
      timezone: dto.settings?.timezone ?? dto.timezone,
      currency: dto.settings?.currency ?? dto.currency ?? 'PKR',
      logo: dto.logo?.trim() || null,
      bannerImage: dto.bannerImage?.trim() || null,
      gallery: dto.gallery?.map((x) => x.trim()).filter(Boolean) ?? [],
      status: (dto.status ?? 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active',
      isActive: (dto.status ?? 'active').toLowerCase() !== 'inactive',
    });
    return this.locationsRepository.save(row);
  }

  async updateBusiness(requesterUserId: string, businessId: string, dto: UpdateBusinessDto): Promise<Business> {
    await this.iamService.assertRequesterActive(requesterUserId);
    const business = await this.businessesRepository.findOne({ where: { id: businessId } });
    if (!business) throw new NotFoundException(`Business ${businessId} not found`);
    Object.assign(business, dto);
    return this.businessesRepository.save(business);
  }

  async updateLocation(requesterUserId: string, locationId: string, dto: UpdateBusinessLocationDto): Promise<BusinessLocation> {
    await this.iamService.assertRequesterActive(requesterUserId);
    const location = await this.locationsRepository.findOne({ where: { id: locationId } });
    if (!location) throw new NotFoundException(`Location ${locationId} not found`);
    if (dto.locationType !== undefined) location.locationType = dto.locationType;
    if (dto.facilityTypes !== undefined) location.facilityTypes = normalizeLocationFacilityTypesForPersist(dto.facilityTypes);
    if (dto.branchName !== undefined || dto.name !== undefined) location.name = dto.branchName ?? dto.name ?? location.name;
    if (dto.addressLine !== undefined || dto.location?.addressLine !== undefined || dto.location?.address !== undefined) {
      location.addressLine = dto.location?.addressLine ?? dto.location?.address ?? dto.addressLine;
    }
    if (dto.details !== undefined || dto.location?.details !== undefined) {
      const next = (dto.details ?? dto.location?.details ?? '').trim();
      location.details = next || null;
    }
    if (dto.city !== undefined || dto.location?.city !== undefined) location.city = dto.location?.city ?? dto.city;
    if (dto.area !== undefined || dto.location?.area !== undefined) location.area = dto.location?.area ?? dto.area;
    if (dto.country !== undefined || dto.location?.country !== undefined) location.country = dto.location?.country ?? dto.country;
    if (dto.latitude !== undefined || dto.location?.coordinates?.lat !== undefined) location.latitude = dto.location?.coordinates?.lat ?? dto.latitude;
    if (dto.longitude !== undefined || dto.location?.coordinates?.lng !== undefined) location.longitude = dto.location?.coordinates?.lng ?? dto.longitude;
    if (dto.phone !== undefined || dto.contact?.phone !== undefined) location.phone = dto.contact?.phone ?? dto.phone;
    if (dto.manager !== undefined || dto.contact?.manager !== undefined) location.manager = dto.contact?.manager ?? dto.manager;
    if (dto.workingHours !== undefined) location.workingHours = dto.workingHours;
    if (dto.timezone !== undefined || dto.settings?.timezone !== undefined) location.timezone = dto.settings?.timezone ?? dto.timezone;
    if (dto.currency !== undefined || dto.settings?.currency !== undefined) location.currency = dto.settings?.currency ?? dto.currency ?? location.currency;
    if (dto.logo !== undefined) location.logo = dto.logo.trim() || null;
    if (dto.bannerImage !== undefined) location.bannerImage = dto.bannerImage.trim() || null;
    if (dto.gallery !== undefined) location.gallery = dto.gallery.map((u) => u.trim()).filter(Boolean);
    if (dto.status !== undefined) {
      location.status = dto.status;
      location.isActive = dto.status.toLowerCase() !== 'inactive';
    }
    return this.locationsRepository.save(location);
  }

  async deleteBusiness(requesterUserId: string, businessId: string): Promise<{ deleted: true; businessId: string }> {
    await this.iamService.assertRequesterActive(requesterUserId);
    await this.businessesRepository.delete({ id: businessId });
    return { deleted: true, businessId };
  }

  async deleteLocation(requesterUserId: string, locationId: string): Promise<{ deleted: true; locationId: string }> {
    await this.iamService.assertRequesterActive(requesterUserId);
    await this.locationsRepository.delete({ id: locationId });
    return { deleted: true, locationId };
  }

  toVenueMapMarker(row: any, category?: string) {
    let price = row.price ?? 0;
    const cat = category?.toLowerCase().trim();

    if (cat && cat !== 'all') {
      const specificPrices: number[] = [];
      if (cat === 'padel') {
        row.facilityCourts
          ?.filter((f: any) => f.facilityType === 'padel')
          .forEach((f: any) => {
            if (f.price > 0) specificPrices.push(f.price);
          });
      } else if (cat === 'futsal' || cat === 'futsalarenas') {
        row.facilityCourts
          ?.filter((f: any) => f.facilityType === 'turf')
          .forEach((f: any) => {
            const p = f.pricing?.futsal?.basePrice;
            if (p > 0) specificPrices.push(p);
          });
      } else if (cat === 'cricket') {
        row.facilityCourts
          ?.filter((f: any) => f.facilityType === 'turf')
          .forEach((f: any) => {
            const p = f.pricing?.cricket?.basePrice;
            if (p > 0) specificPrices.push(p);
          });
      } else if (cat === 'turf') {
        row.facilityCourts
          ?.filter((f: any) => f.facilityType === 'turf')
          .forEach((f: any) => {
            if (f.price > 0) specificPrices.push(f.price);
          });
      } else if (cat === 'gaming' || cat === 'gaming-zone') {
        row.facilityCourts
          ?.filter((f: any) => f.facilityType === 'gaming')
          .forEach((f: any) => {
            if (f.price > 0) specificPrices.push(f.price);
          });
      }

      if (specificPrices.length > 0) {
        price = Math.min(...specificPrices);
      }
    }

    return {
      venueId: row.id,
      name: row.name,
      address: row.addressLine ?? '',
      latitude: row.latitude,
      longitude: row.longitude,
      logo: row.logo,
      bannerImage: row.bannerImage,
      price: price,
      pricePerSlot: price,
    };
  }

  async listVenueMarkersPublic(category: string): Promise<any[]> {
    const rows = (await this.listAllLocationsPublic()).filter((r) => r.isActive);
    const cat = category.toLowerCase().trim();
    let picked = rows;
    if (cat === 'gaming' || cat === 'gaming-zone') {
      picked = rows.filter((r) => (r.locationType ?? '').toLowerCase().includes('gaming') || (r.facilityCounts.gaming ?? 0) > 0);
    } else if (cat === 'padel') {
      picked = rows.filter((r) => (r.facilityCounts.padel ?? 0) > 0);
    } else if (cat === 'futsal' || cat === 'futsalarenas') {
      picked = rows.filter((r) =>
        (r.facilityCourts as any[]).some(
          (f) => f.facilityType === 'turf' && f.supportedSports?.includes('futsal'),
        ),
      );
    } else if (cat === 'cricket') {
      picked = rows.filter((r) =>
        (r.facilityCourts as any[]).some(
          (f) => f.facilityType === 'turf' && f.supportedSports?.includes('cricket'),
        ),
      );
    } else if (cat === 'turf') {
      picked = rows.filter((r) => (r.facilityCounts.turf ?? 0) > 0);
    }
    return picked.map((r) => this.toVenueMapMarker(r, category));
  }

  async listVenueMarkersPublicWithFilters(dto: GetVenuesAllQueryDto) {
    let rows = (await this.listAllLocationsPublic()).filter((r) => r.isActive);
    const category = (dto.category ?? 'all').trim().toLowerCase();
    if (category === 'gaming' || category === 'gaming-zone') {
      rows = rows.filter((r) => (r.locationType ?? '').toLowerCase().includes('gaming') || (r.facilityCounts.gaming ?? 0) > 0);
    } else if (category === 'padel') {
      rows = rows.filter((r) => (r.facilityCounts.padel ?? 0) > 0);
    } else if (category === 'futsal' || category === 'futsalarenas') {
      rows = rows.filter((r) =>
        (r.facilityCourts as any[]).some(
          (f) => f.facilityType === 'turf' && f.supportedSports?.includes('futsal'),
        ),
      );
    } else if (category === 'cricket') {
      rows = rows.filter((r) =>
        (r.facilityCourts as any[]).some(
          (f) => f.facilityType === 'turf' && f.supportedSports?.includes('cricket'),
        ),
      );
    } else if (category === 'turf') {
      rows = rows.filter((r) => (r.facilityCounts.turf ?? 0) > 0);
    }
    if (dto.city?.trim()) {
      const wanted = new Set(dto.city.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean));
      rows = rows.filter((r) => wanted.has((r.city ?? '').toLowerCase()));
    }
    if (dto.q?.trim()) {
      const q = dto.q.trim().toLowerCase();
      rows = rows.filter((r) =>
        [r.name, r.addressLine, r.details, r.city, r.area, r.country, r.business?.businessName]
          .filter(Boolean)
          .join(' ')
          .includes(q),
      );
    }

    if (dto.date && dto.startTime && dto.endTime) {
      const busyKeys = await this.loadBusyCourtKeysForWindow(
        dto.date,
        this.hhMmToMinutes(dto.startTime),
        this.hhMmToMinutes(dto.endTime),
      );
      const locationIds = rows.map((r) => r.id);
      const courtsByLocation = await this.loadCourtKeysByLocationId(locationIds);

      rows = rows.filter((loc) => {
        const courts = courtsByLocation.get(loc.id) ?? [];
        if (courts.length === 0) return false;
        const t = (dto.category ?? 'all').trim().toLowerCase();
        let relevant = courts;
        if (t === 'padel') {
          relevant = courts.filter((c) => c.startsWith('padel_court:'));
        } else if (t === 'turf' || t === 'futsal' || t === 'cricket') {
          relevant = courts.filter((c) => c.startsWith('turf_court:'));
        }
        if (relevant.length === 0) return false;
        return relevant.some((key) => !busyKeys.has(key));
      });
    }

    return rows.map((r) => this.toVenueMapMarker(r, dto.category));
  }

  async getVenueDetailsPublic(locationId: string) {
    const rows = await this.listAllLocationsPublic();
    const row = rows.find((r) => r.id === locationId);
    if (!row) throw new NotFoundException(`Venue ${locationId} not found`);

    const sportsOffered: string[] = [];
    const facilityAvailable: Array<{ label: string; count: number }> = [];
    if (row.facilityCounts.padel > 0) {
      sportsOffered.push('padel');
      facilityAvailable.push({ label: 'Padel', count: row.facilityCounts.padel });
    }
    if (row.facilityCounts.turf > 0) {
      const futsalCount = (row.facilityCourts as any[]).filter(
        (f) => f.facilityType === 'turf' && f.supportedSports?.includes('futsal'),
      ).length;
      const cricketCount = (row.facilityCourts as any[]).filter(
        (f) => f.facilityType === 'turf' && f.supportedSports?.includes('cricket'),
      ).length;

      if (futsalCount > 0) {
        sportsOffered.push('futsal');
        facilityAvailable.push({ label: 'Futsal', count: futsalCount });
      }
      if (cricketCount > 0) {
        sportsOffered.push('cricket');
        facilityAvailable.push({ label: 'Cricket', count: cricketCount });
      }
    }
    if (row.facilityCounts.gaming > 0) {
      sportsOffered.push('gaming');
      facilityAvailable.push({ label: 'Gaming', count: row.facilityCounts.gaming });
    }

    return {
      ...row,
      venueId: row.id,
      address: row.addressLine ?? '',
      clubDetails: {
        businessName: row.business?.businessName ?? null,
        description: row.details,
        sportsOffered,
      },
      currency: row.currency,
      price: row.price ?? 0,
      pricePerSlot: row.price ?? 0,
      packages: [] as unknown[],
      availability: {
        tenantId: row.business?.tenantId ?? null,
        note: 'Use GET /bookings/availability for live slots.',
      },
      facilityAvailable,
      facilityList: (row.facilityCourts ?? []).map((f: any) => ({
        id: f.id,
        name: f.name,
        facilityType: f.facilityType,
        locationId: row.id,
        pricePerSlot: f.price ?? 0,
        supportedSports: f.supportedSports,
      })),
      tenantId: row.business?.tenantId ?? null,
    };
  }

  private hhMmToMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  private async loadBusyCourtKeysForWindow(date: string, reqStart: number, reqEnd: number): Promise<Set<string>> {
    const items = await this.bookingItemRepository.find({
      where: {
        booking: { bookingDate: date },
        itemStatus: In(['reserved', 'confirmed']),
      },
      relations: ['booking'],
    });
    const busy = new Set<string>();
    for (const it of items) {
      const s = this.hhMmToMinutes(it.startTime);
      const e = this.hhMmToMinutes(it.endTime);
      // Overlap: max(s1, s2) < min(e1, e2)
      if (Math.max(s, reqStart) < Math.min(e, reqEnd)) {
        busy.add(`${it.courtKind}:${it.courtId}`);
      }
    }
    return busy;
  }

  private async loadCourtKeysByLocationId(locationIds: string[]): Promise<Map<string, string[]>> {
    const [padel, turf] = await Promise.all([
      this.padelCourtRepository.find({ where: { businessLocationId: In(locationIds), isActive: true, courtStatus: 'active' } }),
      this.turfCourtRepository.find({ where: { branchId: In(locationIds), status: 'active' } }),
    ]);
    const map = new Map<string, string[]>();
    for (const c of padel) {
      const key = c.businessLocationId ?? '';
      const list = map.get(key) ?? [];
      list.push(`padel_court:${c.id}`);
      map.set(key, list);
    }
    for (const c of turf) {
      const key = c.branchId ?? '';
      const list = map.get(key) ?? [];
      list.push(`turf_court:${c.id}`);
      map.set(key, list);
    }
    return map;
  }

  private filterLocationRowsByName<T extends { name?: string | null }>(rows: T[], nameFilter?: string | null): T[] {
    const n = nameFilter?.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter((r) => (r.name ?? '').toLowerCase().includes(n));
  }
}
