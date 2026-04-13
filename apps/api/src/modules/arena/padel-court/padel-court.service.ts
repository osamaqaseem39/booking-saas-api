import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';
import { TimeSlotTemplatesService } from '../../bookings/time-slot-templates.service';
import { BusinessesService } from '../../businesses/businesses.service';
import { assertFacilityTypeAllowedForLocation } from '../location-facility.util';
import { CreatePadelCourtDto } from './dto/create-padel-court.dto';
import { UpdatePadelCourtDto } from './dto/update-padel-court.dto';
import { PadelCourt } from './entities/padel-court.entity';

const PADEL_LOCATION_FACILITY_CODE = 'padel' as const;

function dec(n?: number): string | undefined {
  if (n === undefined || n === null || Number.isNaN(n)) return undefined;
  return String(n);
}

@Injectable()
export class PadelCourtService {
  constructor(
    @InjectRepository(PadelCourt)
    private readonly repo: Repository<PadelCourt>,
    private readonly businessesService: BusinessesService,
    private readonly timeSlotTemplates: TimeSlotTemplatesService,
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
  ): Promise<PadelCourt[]> {
    if (!tenantId || tenantId === 'public') return [];
    if (
      businessLocationId !== undefined &&
      businessLocationId !== '' &&
      !isUUID(businessLocationId, '4')
    ) {
      throw new BadRequestException('businessLocationId must be a UUID v4');
    }
    const locWhere =
      businessLocationId && businessLocationId !== ''
        ? { businessLocationId }
        : {};
    return this.repo.find({
      where: { tenantId, ...locWhere },
      order: { name: 'ASC' },
    });
  }

  async create(
    tenantId: string,
    dto: CreatePadelCourtDto,
  ): Promise<PadelCourt> {
    this.requireTenant(tenantId);
    const location = await this.businessesService.assertLocationBelongsToTenant(
      dto.businessLocationId,
      tenantId,
    );
    assertFacilityTypeAllowedForLocation(
      location,
      PADEL_LOCATION_FACILITY_CODE,
    );

    let timeSlotTemplateId: string | null = null;
    if (dto.timeSlotTemplateId) {
      await this.timeSlotTemplates.assertBelongsToTenant(
        tenantId,
        dto.timeSlotTemplateId,
      );
      timeSlotTemplateId = dto.timeSlotTemplateId;
    }

    const courtStatus = dto.courtStatus ?? 'active';
    const isActive =
      dto.isActive !== undefined ? dto.isActive : courtStatus === 'active';

    const row = this.repo.create({
      tenantId,
      businessLocationId: dto.businessLocationId,
      name: dto.name,
      arenaLabel: dto.arenaLabel,
      courtStatus,
      description: dto.description,
      imageUrls: dto.imageUrls ?? [],
      ceilingHeightValue: dec(dto.ceilingHeightValue),
      ceilingHeightUnit: dto.ceilingHeightUnit,
      coveredType: dto.coveredType,
      glassWalls: dto.glassWalls ?? true,
      wallType: dto.wallType,
      lighting: dto.lighting,
      ventilation: dto.ventilation,
      lengthM: dec(dto.lengthM ?? 20),
      widthM: dec(dto.widthM ?? 10),
      surfaceType: dto.surfaceType,
      matchType: dto.matchType ?? 'doubles',
      maxPlayers: dto.maxPlayers ?? 4,
      pricePerSlot: dec(dto.pricePerSlot),
      peakPricing: dto.peakPricing,
      membershipPrice: dec(dto.membershipPrice),
      slotDurationMinutes: dto.slotDurationMinutes,
      bufferBetweenSlotsMinutes: dto.bufferBetweenSlotsMinutes,
      extras: dto.extras,
      amenities: dto.amenities,
      rules: dto.rules,
      isActive,
      timeSlotTemplateId,
    });
    return this.repo.save(row);
  }

  async findOne(tenantId: string, id: string): Promise<PadelCourt> {
    this.requireTenant(tenantId);
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) {
      throw new NotFoundException(`Padel court ${id} not found`);
    }
    return row;
  }

  /**
   * Public read by court UUID only (no `X-Tenant-Id`). Same row shape as {@link findOne};
   * only **active** courts (`isActive` + `courtStatus`) are returned.
   */
  async findOnePublicById(id: string): Promise<PadelCourt> {
    const row = await this.repo.findOne({
      where: { id },
      relations: ['businessLocation'],
    });
    if (!row || !row.isActive || row.courtStatus !== 'active') {
      throw new NotFoundException(`Padel court ${id} not found`);
    }
    return row;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdatePadelCourtDto,
  ): Promise<PadelCourt> {
    const row = await this.findOne(tenantId, id);

    if (dto.name !== undefined) row.name = dto.name;
    if (dto.arenaLabel !== undefined) row.arenaLabel = dto.arenaLabel;
    if (dto.description !== undefined) row.description = dto.description;
    if (dto.imageUrls !== undefined) row.imageUrls = dto.imageUrls;
    if (dto.ceilingHeightValue !== undefined)
      row.ceilingHeightValue = dec(dto.ceilingHeightValue);
    if (dto.ceilingHeightUnit !== undefined)
      row.ceilingHeightUnit = dto.ceilingHeightUnit;
    if (dto.coveredType !== undefined) row.coveredType = dto.coveredType;
    if (dto.glassWalls !== undefined) row.glassWalls = dto.glassWalls;
    if (dto.wallType !== undefined) row.wallType = dto.wallType;
    if (dto.lighting !== undefined) row.lighting = dto.lighting;
    if (dto.ventilation !== undefined) row.ventilation = dto.ventilation;
    if (dto.lengthM !== undefined) row.lengthM = dec(dto.lengthM);
    if (dto.widthM !== undefined) row.widthM = dec(dto.widthM);
    if (dto.surfaceType !== undefined) row.surfaceType = dto.surfaceType;
    if (dto.matchType !== undefined) row.matchType = dto.matchType;
    if (dto.maxPlayers !== undefined) row.maxPlayers = dto.maxPlayers;
    if (dto.pricePerSlot !== undefined)
      row.pricePerSlot = dec(dto.pricePerSlot);
    if (dto.peakPricing !== undefined) row.peakPricing = dto.peakPricing;
    if (dto.membershipPrice !== undefined)
      row.membershipPrice = dec(dto.membershipPrice);
    if (dto.slotDurationMinutes !== undefined)
      row.slotDurationMinutes = dto.slotDurationMinutes;
    if (dto.bufferBetweenSlotsMinutes !== undefined)
      row.bufferBetweenSlotsMinutes = dto.bufferBetweenSlotsMinutes;
    if (dto.extras !== undefined) row.extras = dto.extras;
    if (dto.amenities !== undefined) row.amenities = dto.amenities;
    if (dto.rules !== undefined) row.rules = dto.rules;
    if (dto.timeSlotTemplateId !== undefined) {
      if (dto.timeSlotTemplateId) {
        await this.timeSlotTemplates.assertBelongsToTenant(
          tenantId,
          dto.timeSlotTemplateId,
        );
        row.timeSlotTemplateId = dto.timeSlotTemplateId;
      } else {
        row.timeSlotTemplateId = null;
      }
    }

    if (dto.courtStatus !== undefined) {
      row.courtStatus = dto.courtStatus;
      if (dto.isActive === undefined) {
        row.isActive = dto.courtStatus === 'active';
      }
    }
    if (dto.isActive !== undefined) row.isActive = dto.isActive;

    return this.repo.save(row);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const row = await this.findOne(tenantId, id);
    await this.repo.remove(row);
  }
}
