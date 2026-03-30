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
      password: dto.admin.password,
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

    if (dto.name !== undefined) location.name = dto.name;
    if (dto.locationType !== undefined) location.locationType = dto.locationType;
    if (dto.facilityTypes !== undefined) location.facilityTypes = dto.facilityTypes;
    if (dto.addressLine !== undefined) location.addressLine = dto.addressLine;
    if (dto.city !== undefined) location.city = dto.city;
    if (dto.phone !== undefined) location.phone = dto.phone;
    if (dto.isActive !== undefined) location.isActive = dto.isActive;

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
