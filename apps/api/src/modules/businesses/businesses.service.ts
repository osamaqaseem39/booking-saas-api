import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { IamService } from '../iam/iam.service';
import { CreateBusinessLocationDto } from './dto/create-business-location.dto';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpdateBusinessLocationDto } from './dto/update-business-location.dto';
import { BusinessLocation } from './entities/business-location.entity';
import { Business } from './entities/business.entity';
import { BusinessMembership } from './entities/business-membership.entity';

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
  ) {}

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

  async listForRequester(requesterUserId: string) {
    const businesses = await this.businessesRepository.find({
      order: { createdAt: 'DESC' },
    });
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

  async onboardBusiness(dto: CreateBusinessDto) {
    const duplicate = await this.businessesRepository.findOne({
      where: { businessName: dto.businessName },
    });
    if (duplicate) {
      throw new BadRequestException(
        `Business ${dto.businessName} already exists in onboarding store`,
      );
    }

    const normalizedVertical = (dto.vertical ?? 'arena').trim() || 'arena';
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
      vertical: normalizedVertical,
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
    const savedBusiness = await this.businessesRepository.save(business);

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
    const businesses = await this.businessesRepository.find();
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
    return scoped.map((loc) => {
      const b = businessById.get(loc.businessId);
      return {
        id: loc.id,
        businessId: loc.businessId,
        branchId: loc.branchId,
        arenaId: loc.arenaId,
        locationType: loc.locationType,
        facilityTypes: loc.facilityTypes ?? [],
        name: loc.name,
        addressLine: loc.addressLine,
        city: loc.city,
        area: loc.area,
        country: loc.country,
        latitude: loc.latitude,
        longitude: loc.longitude,
        phone: loc.phone,
        manager: loc.manager,
        workingHours: loc.workingHours,
        timezone: loc.timezone,
        currency: loc.currency,
        status: loc.status,
        isActive: loc.isActive,
        createdAt: loc.createdAt,
        business: b
          ? {
              id: b.id,
              businessName: b.businessName,
              tenantId: b.tenantId,
              vertical: b.vertical,
            }
          : null,
      };
    });
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
    const business = await this.businessesRepository.findOne({
      where: { id: dto.businessId },
    });
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
    const sourceAddress = dto.location?.address ?? dto.addressLine;
    const sourceCity = dto.location?.city ?? dto.city;
    const sourceArea = dto.location?.area ?? dto.area;
    const sourceCountry = dto.location?.country ?? dto.country;
    const sourcePhone = dto.contact?.phone ?? dto.phone;
    const sourceManager = dto.contact?.manager ?? dto.manager;
    const sourceTimezone = dto.settings?.timezone ?? dto.timezone;
    const sourceCurrency = dto.settings?.currency ?? dto.currency;
    const sourceLatitude = dto.location?.coordinates?.lat ?? dto.latitude;
    const sourceLongitude = dto.location?.coordinates?.lng ?? dto.longitude;
    const sourceStatus = dto.status ?? 'active';

    const row = this.locationsRepository.create({
      businessId: dto.businessId,
      branchId: dto.branchId,
      arenaId: dto.arenaId,
      locationType: dto.locationType ?? 'arena',
      facilityTypes: dto.facilityTypes?.length ? dto.facilityTypes : [],
      name: sourceName,
      addressLine: sourceAddress,
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
      status: sourceStatus,
      isActive: sourceStatus === 'active',
    });
    return this.locationsRepository.save(row);
  }

  async updateBusiness(
    requesterUserId: string,
    businessId: string,
    dto: UpdateBusinessDto,
  ): Promise<Business> {
    const business = await this.businessesRepository.findOne({
      where: { id: businessId },
    });
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
      const duplicate = await this.businessesRepository.findOne({
        where: { businessName: dto.businessName },
      });
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
    if (dto.vertical !== undefined) {
      business.vertical = dto.vertical;
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

    return this.businessesRepository.save(business);
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
    if (dto.branchId !== undefined) location.branchId = dto.branchId;
    if (dto.arenaId !== undefined) location.arenaId = dto.arenaId;
    if (dto.locationType !== undefined) location.locationType = dto.locationType;
    if (dto.facilityTypes !== undefined) location.facilityTypes = dto.facilityTypes;
    if (dto.addressLine !== undefined || dto.location?.address !== undefined) {
      location.addressLine = dto.location?.address ?? dto.addressLine;
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
      location.latitude = dto.location?.coordinates?.lat ?? dto.latitude;
    }
    if (
      dto.longitude !== undefined ||
      dto.location?.coordinates?.lng !== undefined
    ) {
      location.longitude = dto.location?.coordinates?.lng ?? dto.longitude;
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
    if (dto.status !== undefined) location.status = dto.status;
    if (dto.isActive !== undefined) location.isActive = dto.isActive;
    if (dto.status !== undefined && dto.isActive === undefined) {
      location.isActive = dto.status === 'active';
    }

    return this.locationsRepository.save(location);
  }

  async deleteBusiness(
    requesterUserId: string,
    businessId: string,
  ): Promise<{ deleted: true; businessId: string }> {
    const business = await this.businessesRepository.findOne({
      where: { id: businessId },
    });
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
}
