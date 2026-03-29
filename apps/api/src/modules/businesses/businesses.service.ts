import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IamService } from '../iam/iam.service';
import { CreateBusinessLocationDto } from './dto/create-business-location.dto';
import { CreateBusinessDto } from './dto/create-business.dto';
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

    const business = this.businessesRepository.create({
      tenantId: randomUUID(),
      businessName: dto.businessName,
      legalName: dto.legalName,
      vertical: dto.vertical,
    });
    const savedBusiness = await this.businessesRepository.save(business);

    const adminUser = await this.iamService.ensureUser({
      fullName: dto.admin.fullName,
      email: dto.admin.email,
      phone: dto.admin.phone,
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
    const allLocations = await this.locationsRepository.find({
      order: { createdAt: 'DESC' },
    });
    const businesses = await this.businessesRepository.find();
    const businessById = new Map(businesses.map((b) => [b.id, b]));
    const isPlatformOwner = await this.iamService.hasAnyRole(requesterUserId, [
      'platform-owner',
    ]);
    let scoped = allLocations;
    if (!isPlatformOwner) {
      const allowedBusinessIds = new Set(
        (
          await this.listForRequester(requesterUserId)
        ).map((b) => b.id),
      );
      scoped = allLocations.filter((l) => allowedBusinessIds.has(l.businessId));
    }
    return scoped.map((loc) => {
      const b = businessById.get(loc.businessId);
      return {
        id: loc.id,
        businessId: loc.businessId,
        locationType: loc.locationType,
        facilityTypes: loc.facilityTypes ?? [],
        name: loc.name,
        addressLine: loc.addressLine,
        city: loc.city,
        phone: loc.phone,
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
    const row = this.locationsRepository.create({
      businessId: dto.businessId,
      locationType: dto.locationType,
      facilityTypes: dto.facilityTypes?.length ? dto.facilityTypes : [],
      name: dto.name,
      addressLine: dto.addressLine,
      city: dto.city,
      phone: dto.phone,
    });
    return this.locationsRepository.save(row);
  }
}
