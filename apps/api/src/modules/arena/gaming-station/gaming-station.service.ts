import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';
import { BusinessesService } from '../../businesses/businesses.service';
import { assertFacilityTypeAllowedForLocation } from '../location-facility.util';
import { CreateGamingStationDto } from './dto/create-gaming-station.dto';
import { UpdateGamingStationDto } from './dto/update-gaming-station.dto';
import { GamingStation } from './entities/gaming-station.entity';

function dec(n?: number): string | undefined {
  if (n === undefined || n === null || Number.isNaN(n)) return undefined;
  return String(n);
}

@Injectable()
export class GamingStationService {
  constructor(
    @InjectRepository(GamingStation)
    private readonly repo: Repository<GamingStation>,
    private readonly businessesService: BusinessesService,
  ) {}

  private requireTenant(tenantId: string): void {
    if (!tenantId || tenantId === 'public') {
      throw new BadRequestException(
        'A valid business tenant is required (send x-tenant-id)',
      );
    }
  }

  async list(
    tenantId: string,
    businessLocationId?: string,
    setupCode?: string,
  ): Promise<GamingStation[]> {
    if (!tenantId || tenantId === 'public') return [];
    if (
      businessLocationId !== undefined &&
      businessLocationId !== '' &&
      !isUUID(businessLocationId, '4')
    ) {
      throw new BadRequestException('businessLocationId must be a UUID v4');
    }
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId });
    if (businessLocationId && businessLocationId !== '') {
      qb.andWhere('s.businessLocationId = :businessLocationId', {
        businessLocationId,
      });
    }
    if (setupCode?.trim()) {
      qb.andWhere('s.setupCode = :setupCode', { setupCode: setupCode.trim() });
    }
    return qb.orderBy('s.name', 'ASC').getMany();
  }

  async create(
    tenantId: string,
    dto: CreateGamingStationDto,
  ): Promise<GamingStation> {
    this.requireTenant(tenantId);
    const location = await this.businessesService.assertLocationBelongsToTenant(
      dto.businessLocationId,
      tenantId,
    );
    if ((location.locationType ?? '') !== 'gaming-zone') {
      throw new BadRequestException(
        `Location "${location.name}" is not a gaming-zone location.`,
      );
    }
    assertFacilityTypeAllowedForLocation(location, dto.setupCode);

    const row = this.repo.create({
      tenantId,
      businessLocationId: dto.businessLocationId,
      setupCode: dto.setupCode,
      name: dto.name,
      unitStatus: dto.unitStatus ?? 'active',
      isActive: dto.isActive ?? true,
      description: dto.description,
      imageUrls: dto.imageUrls ?? [],
      pricePerSlot: dec(dto.pricePerSlot),
      peakPricing: dto.peakPricing,
      bundleNote: dto.bundleNote,
      slotDurationMinutes: dto.slotDurationMinutes,
      bufferBetweenSlotsMinutes: dto.bufferBetweenSlotsMinutes,
      amenities: dto.amenities,
      specs: dto.specs,
    });
    return this.repo.save(row);
  }

  async findOne(tenantId: string, id: string): Promise<GamingStation> {
    this.requireTenant(tenantId);
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) {
      throw new NotFoundException(`Gaming station ${id} not found`);
    }
    return row;
  }

  async findOneBySetup(
    tenantId: string,
    id: string,
    setupCode: GamingStation['setupCode'],
  ): Promise<GamingStation> {
    const row = await this.findOne(tenantId, id);
    if (row.setupCode !== setupCode) {
      throw new NotFoundException(`Gaming station ${id} not found`);
    }
    return row;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateGamingStationDto,
  ): Promise<GamingStation> {
    const row = await this.findOne(tenantId, id);
    if (dto.businessLocationId !== undefined || dto.setupCode !== undefined) {
      const locationId = dto.businessLocationId ?? row.businessLocationId;
      const setupCode = dto.setupCode ?? row.setupCode;
      const location = await this.businessesService.assertLocationBelongsToTenant(
        locationId,
        tenantId,
      );
      if ((location.locationType ?? '') !== 'gaming-zone') {
        throw new BadRequestException(
          `Location "${location.name}" is not a gaming-zone location.`,
        );
      }
      assertFacilityTypeAllowedForLocation(location, setupCode);
    }

    const patch: Partial<GamingStation> = {};
    const assign = <K extends keyof GamingStation>(key: K, val: GamingStation[K]) => {
      if (val !== undefined)
        (patch as Record<string, unknown>)[key as string] = val;
    };
    if (dto.businessLocationId !== undefined) assign('businessLocationId', dto.businessLocationId);
    if (dto.setupCode !== undefined) assign('setupCode', dto.setupCode);
    if (dto.name !== undefined) assign('name', dto.name);
    if (dto.unitStatus !== undefined) assign('unitStatus', dto.unitStatus);
    if (dto.isActive !== undefined) assign('isActive', dto.isActive);
    if (dto.description !== undefined) assign('description', dto.description);
    if (dto.imageUrls !== undefined) assign('imageUrls', dto.imageUrls);
    if (dto.pricePerSlot !== undefined) assign('pricePerSlot', dec(dto.pricePerSlot));
    if (dto.peakPricing !== undefined) assign('peakPricing', dto.peakPricing);
    if (dto.bundleNote !== undefined) assign('bundleNote', dto.bundleNote);
    if (dto.slotDurationMinutes !== undefined)
      assign('slotDurationMinutes', dto.slotDurationMinutes);
    if (dto.bufferBetweenSlotsMinutes !== undefined)
      assign('bufferBetweenSlotsMinutes', dto.bufferBetweenSlotsMinutes);
    if (dto.amenities !== undefined) assign('amenities', dto.amenities);
    if (dto.specs !== undefined) assign('specs', dto.specs);

    Object.assign(row, patch);
    return this.repo.save(row);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const row = await this.findOne(tenantId, id);
    await this.repo.remove(row);
  }
}
