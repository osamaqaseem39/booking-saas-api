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
    const isPlatformOwner = await this.iamService.hasAnyRole(requesterUserId, ['platform-owner']);
    const scoped = isPlatformOwner
      ? businesses
      : businesses.filter((b) =>
          memberships.some((m) => m.businessId === b.id && m.userId === requesterUserId),
        );
    return scoped.map((business) => ({
      ...business,
      memberships: memberships.filter((membership) => membership.businessId === business.id),
    }));
  }

  async getDashboardView(requesterUserId: string) {
    const businesses = await this.listForRequester(requesterUserId);
    const businessIds = businesses.map((b) => b.id);
    const locations = await this.locationsRepository.find({
      where: { businessId: In(businessIds) },
      select: ['id', 'businessId'],
    });
    const locIds = locations.map((l) => l.id);
    const courts = locIds.length
      ? await this.padelCourtRepository.find({
          where: { businessLocationId: In(locIds), courtStatus: 'active', isActive: true },
          select: ['id', 'businessLocationId'],
        })
      : [];
    const locationBusinessMap = new Map(locations.map((l) => [l.id, l.businessId]));
    const courtCountByBusiness = new Map<string, number>();
    for (const c of courts) {
      const bId = locationBusinessMap.get(c.businessLocationId ?? '');
      if (!bId) continue;
      courtCountByBusiness.set(bId, (courtCountByBusiness.get(bId) ?? 0) + 1);
    }

    return {
      generatedAt: new Date().toISOString(),
      scope: { businessCount: businesses.length, locationCount: locations.length },
      totals: {
        courtCount: courts.length,
        bookingCount: 0,
        confirmedBookingCount: 0,
        pendingBookingCount: 0,
        cancelledBookingCount: 0,
        revenueTotal: 0,
        revenuePaid: 0,
      },
      businesses: businesses.map((b) => ({
        businessId: b.id,
        tenantId: b.tenantId,
        businessName: b.businessName,
        status: b.status,
        locationCount: locations.filter((l) => l.businessId === b.id).length,
        courtCount: courtCountByBusiness.get(b.id) ?? 0,
        bookingCount: 0,
        confirmedBookingCount: 0,
        pendingBookingCount: 0,
        cancelledBookingCount: 0,
        revenueTotal: 0,
        revenuePaid: 0,
      })),
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
    return this.iamService.hasAnyRole(userId, ['platform-owner', 'business-admin', 'business-staff']);
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
    const isPlatformOwner = await this.iamService.hasAnyRole(requesterUserId, ['platform-owner']);
    if (isPlatformOwner) return this.listAllLocationsPublic();
    const businesses = await this.listForRequester(requesterUserId);
    const businessIds = businesses.map((b) => b.id);
    const all = await this.listAllLocationsPublic();
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
            where: { businessLocationId: In(locationIds), isActive: true, courtStatus: 'active' },
            select: ['id', 'name', 'businessLocationId'],
          }),
          this.turfCourtRepository.find({
            where: { branchId: In(locationIds), status: 'active' },
            select: ['id', 'name', 'branchId'],
          }),
          this.gamingStationRepository.find({
            where: { businessLocationId: In(locationIds), isActive: true, unitStatus: 'active' },
            select: ['id', 'name', 'businessLocationId'],
          }),
        ])
      : [[], [], []];

    const facilityCourtsByLocation = new Map<string, Array<{ facilityType: 'padel' | 'turf' | 'gaming'; id: string; name: string }>>();

    for (const c of padelCourts) {
      const key = c.businessLocationId ?? '';
      const rows = facilityCourtsByLocation.get(key) ?? [];
      rows.push({ facilityType: 'padel', id: c.id, name: c.name });
      facilityCourtsByLocation.set(key, rows);
    }
    for (const c of turfCourts) {
      const key = c.branchId ?? '';
      const rows = facilityCourtsByLocation.get(key) ?? [];
      rows.push({ facilityType: 'turf', id: c.id, name: c.name });
      facilityCourtsByLocation.set(key, rows);
    }
    for (const c of gamingStations) {
      const key = c.businessLocationId ?? '';
      const rows = facilityCourtsByLocation.get(key) ?? [];
      rows.push({ facilityType: 'gaming', id: c.id, name: c.name });
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
      rows = rows.filter((r) => (r.locationType ?? '').toLowerCase() === t || (t === 'padel' && (r.facilityCounts.padel ?? 0) > 0));
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

    return rows.map((r) => this.toVenueMapMarker(r));
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

  toVenueMapMarker(row: any) {
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

  async listVenueMarkersPublic(category: string): Promise<any[]> {
    const rows = (await this.listAllLocationsPublic()).filter((r) => r.isActive);
    const cat = category.toLowerCase().trim();
    let picked = rows;
    if (cat === 'gaming' || cat === 'gaming-zone') {
      picked = rows.filter((r) => (r.locationType ?? '').toLowerCase().includes('gaming') || (r.facilityCounts.gaming ?? 0) > 0);
    } else if (cat === 'padel') {
      picked = rows.filter((r) => (r.facilityCounts.padel ?? 0) > 0);
    } else if (cat === 'futsal' || cat === 'futsalarenas') {
      picked = rows.filter((r) => (r.facilityCounts.turf ?? 0) > 0);
    } else if (cat === 'cricket') {
      picked = rows.filter((r) => (r.facilityCounts.turf ?? 0) > 0);
    } else if (cat === 'turf') {
      picked = rows.filter((r) => (r.facilityCounts.turf ?? 0) > 0);
    }
    return picked.map((r) => this.toVenueMapMarker(r));
  }

  async listVenueMarkersPublicWithFilters(dto: GetVenuesAllQueryDto) {
    let rows = (await this.listAllLocationsPublic()).filter((r) => r.isActive);
    const category = (dto.category ?? 'all').trim().toLowerCase();
    if (category === 'gaming' || category === 'gaming-zone') {
      rows = rows.filter((r) => (r.locationType ?? '').toLowerCase().includes('gaming') || (r.facilityCounts.gaming ?? 0) > 0);
    } else if (category === 'padel') {
      rows = rows.filter((r) => (r.facilityCounts.padel ?? 0) > 0);
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

    return rows.map((r) => this.toVenueMapMarker(r));
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
      sportsOffered.push('futsal', 'cricket');
      facilityAvailable.push(
        { label: 'Futsal', count: row.facilityCounts.turf },
        { label: 'Cricket', count: row.facilityCounts.turf },
      );
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
      price: null as number | null,
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
