import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { In, Repository } from 'typeorm';
import { BusinessesService } from '../../businesses/businesses.service';
import { assertFacilityTypeAllowedForLocation } from '../location-facility.util';
import { CreateTurfCourtDto } from './dto/create-turf-court.dto';
import { UpdateTurfCourtDto } from './dto/update-turf-court.dto';
import { TurfCourt } from './entities/turf-court.entity';
import {
  turfSportModeToFlags,
  type TurfSportFilter,
} from './turf-sport-mode.util';

const TURF_LOCATION_FACILITY_CODE = 'turf-court' as const;

function dec(n?: number): string | undefined {
  if (n === undefined || n === null || Number.isNaN(n)) return undefined;
  return String(n);
}

@Injectable()
export class TurfCourtService {
  constructor(
    @InjectRepository(TurfCourt)
    private readonly repo: Repository<TurfCourt>,
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
    sport?: TurfSportFilter,
    businessLocationId?: string,
  ): Promise<TurfCourt[]> {
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
    if (sport === 'futsal') {
      return this.repo.find({
        where: {
          tenantId,
          sportMode: In(['futsal_only', 'both']),
          ...locWhere,
        },
        order: { name: 'ASC' },
      });
    }
    if (sport === 'cricket') {
      return this.repo.find({
        where: {
          tenantId,
          sportMode: In(['cricket_only', 'both']),
          ...locWhere,
        },
        order: { name: 'ASC' },
      });
    }
    return this.repo.find({
      where: { tenantId, ...locWhere },
      order: { name: 'ASC' },
    });
  }

  async create(tenantId: string, dto: CreateTurfCourtDto): Promise<TurfCourt> {
    this.requireTenant(tenantId);
    const location = await this.businessesService.assertLocationBelongsToTenant(
      dto.businessLocationId,
      tenantId,
    );
    assertFacilityTypeAllowedForLocation(location, TURF_LOCATION_FACILITY_CODE);
    const { supportsFutsal, supportsCricket } = turfSportModeToFlags(
      dto.sportMode,
    );

    const row = this.repo.create({
      tenantId,
      businessLocationId: dto.businessLocationId,
      name: dto.name,
      sportMode: dto.sportMode,
      arenaLabel: dto.arenaLabel,
      courtStatus: dto.courtStatus ?? 'active',
      imageUrls: dto.imageUrls ?? [],
      ceilingHeightValue: dec(dto.ceilingHeightValue),
      ceilingHeightUnit: dto.ceilingHeightUnit,
      coveredType: dto.coveredType,
      sideNetting: dto.sideNetting,
      netHeight: dto.netHeight,
      boundaryType: dto.boundaryType,
      ventilation: dto.ventilation,
      lighting: dto.lighting,
      lengthM: dec(dto.lengthM),
      widthM: dec(dto.widthM),
      surfaceType: dto.surfaceType,
      turfQuality: dto.turfQuality,
      shockAbsorptionLayer: dto.shockAbsorptionLayer,
      supportsFutsal,
      supportsCricket,
      futsalFormat: dto.futsalFormat,
      futsalGoalPostsAvailable: dto.futsalGoalPostsAvailable,
      futsalGoalPostSize: dto.futsalGoalPostSize,
      futsalLineMarkings: dto.futsalLineMarkings,
      cricketFormat: dto.cricketFormat,
      cricketStumpsAvailable: dto.cricketStumpsAvailable,
      cricketBowlingMachine: dto.cricketBowlingMachine,
      cricketPracticeMode: dto.cricketPracticeMode,
      futsalPricePerSlot: dec(dto.futsalPricePerSlot),
      cricketPricePerSlot: dec(dto.cricketPricePerSlot),
      peakPricing: dto.peakPricing,
      discountMembership: dto.discountMembership,
      slotDurationMinutes: dto.slotDurationMinutes,
      bufferBetweenSlotsMinutes: dto.bufferBetweenSlotsMinutes,
      allowParallelBooking: dto.allowParallelBooking,
      amenities: dto.amenities,
      rules: dto.rules,
    });
    return this.repo.save(row);
  }

  async findOne(tenantId: string, id: string): Promise<TurfCourt> {
    this.requireTenant(tenantId);
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) {
      throw new NotFoundException(`Turf court ${id} not found`);
    }
    return row;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateTurfCourtDto,
  ): Promise<TurfCourt> {
    const row = await this.findOne(tenantId, id);

    const patch: Partial<TurfCourt> = {};
    const assign = <K extends keyof TurfCourt>(key: K, val: TurfCourt[K]) => {
      if (val !== undefined)
        (patch as Record<string, unknown>)[key as string] = val;
    };

    if (dto.name !== undefined) assign('name', dto.name);
    if (dto.arenaLabel !== undefined) assign('arenaLabel', dto.arenaLabel);
    if (dto.courtStatus !== undefined) assign('courtStatus', dto.courtStatus);
    if (dto.imageUrls !== undefined) assign('imageUrls', dto.imageUrls);
    if (dto.ceilingHeightValue !== undefined)
      assign('ceilingHeightValue', dec(dto.ceilingHeightValue));
    if (dto.ceilingHeightUnit !== undefined)
      assign('ceilingHeightUnit', dto.ceilingHeightUnit);
    if (dto.coveredType !== undefined) assign('coveredType', dto.coveredType);
    if (dto.sideNetting !== undefined) assign('sideNetting', dto.sideNetting);
    if (dto.netHeight !== undefined) assign('netHeight', dto.netHeight);
    if (dto.boundaryType !== undefined)
      assign('boundaryType', dto.boundaryType);
    if (dto.ventilation !== undefined) assign('ventilation', dto.ventilation);
    if (dto.lighting !== undefined) assign('lighting', dto.lighting);
    if (dto.lengthM !== undefined) assign('lengthM', dec(dto.lengthM));
    if (dto.widthM !== undefined) assign('widthM', dec(dto.widthM));
    if (dto.surfaceType !== undefined) assign('surfaceType', dto.surfaceType);
    if (dto.turfQuality !== undefined) assign('turfQuality', dto.turfQuality);
    if (dto.shockAbsorptionLayer !== undefined)
      assign('shockAbsorptionLayer', dto.shockAbsorptionLayer);
    if (dto.sportMode !== undefined) {
      const flags = turfSportModeToFlags(dto.sportMode);
      assign('sportMode', dto.sportMode);
      assign('supportsFutsal', flags.supportsFutsal);
      assign('supportsCricket', flags.supportsCricket);
    }
    if (dto.futsalFormat !== undefined)
      assign('futsalFormat', dto.futsalFormat);
    if (dto.futsalGoalPostsAvailable !== undefined)
      assign('futsalGoalPostsAvailable', dto.futsalGoalPostsAvailable);
    if (dto.futsalGoalPostSize !== undefined)
      assign('futsalGoalPostSize', dto.futsalGoalPostSize);
    if (dto.futsalLineMarkings !== undefined)
      assign('futsalLineMarkings', dto.futsalLineMarkings);
    if (dto.cricketFormat !== undefined)
      assign('cricketFormat', dto.cricketFormat);
    if (dto.cricketStumpsAvailable !== undefined)
      assign('cricketStumpsAvailable', dto.cricketStumpsAvailable);
    if (dto.cricketBowlingMachine !== undefined)
      assign('cricketBowlingMachine', dto.cricketBowlingMachine);
    if (dto.cricketPracticeMode !== undefined)
      assign('cricketPracticeMode', dto.cricketPracticeMode);
    if (dto.futsalPricePerSlot !== undefined)
      assign('futsalPricePerSlot', dec(dto.futsalPricePerSlot));
    if (dto.cricketPricePerSlot !== undefined)
      assign('cricketPricePerSlot', dec(dto.cricketPricePerSlot));
    if (dto.peakPricing !== undefined) assign('peakPricing', dto.peakPricing);
    if (dto.discountMembership !== undefined)
      assign('discountMembership', dto.discountMembership);
    if (dto.slotDurationMinutes !== undefined)
      assign('slotDurationMinutes', dto.slotDurationMinutes);
    if (dto.bufferBetweenSlotsMinutes !== undefined)
      assign('bufferBetweenSlotsMinutes', dto.bufferBetweenSlotsMinutes);
    if (dto.allowParallelBooking !== undefined)
      assign('allowParallelBooking', dto.allowParallelBooking);
    if (dto.amenities !== undefined) assign('amenities', dto.amenities);
    if (dto.rules !== undefined) assign('rules', dto.rules);

    Object.assign(row, patch);
    return this.repo.save(row);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const row = await this.findOne(tenantId, id);
    await this.repo.remove(row);
  }
}
