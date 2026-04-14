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
import { FutsalCourt } from '../futsal-court/entities/futsal-court.entity';
import { futsalDualTurfAsCricketCourt } from '../futsal-dual-turf-as-cricket.util';
import { CreateCricketCourtDto } from './dto/create-cricket-court.dto';
import { UpdateCricketCourtDto } from './dto/update-cricket-court.dto';
import { CricketCourt } from './entities/cricket-court.entity';

function dec(n?: number): string | undefined {
  if (n === undefined || n === null || Number.isNaN(n)) return undefined;
  return String(n);
}

@Injectable()
export class ArenaTurfSurfacesService {
  constructor(
    @InjectRepository(CricketCourt)
    private readonly repo: Repository<CricketCourt>,
    @InjectRepository(FutsalCourt)
    private readonly futsalRepo: Repository<FutsalCourt>,
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
  ): Promise<CricketCourt[]> {
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
    const cricketRows = await this.repo.find({
      where: { tenantId, ...locWhere },
      order: { name: 'ASC' },
    });
    const dualFutsal = await this.futsalRepo.find({
      where: { tenantId, supportsCricket: true, ...locWhere },
      order: { name: 'ASC' },
    });
    const cricketIds = new Set(cricketRows.map((r) => r.id));
    const synthetic = dualFutsal
      .filter((f) => !cricketIds.has(f.id))
      .map((f) => futsalDualTurfAsCricketCourt(f));
    return [...cricketRows, ...synthetic].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  }

  async create(
    tenantId: string,
    dto: CreateCricketCourtDto,
  ): Promise<CricketCourt> {
    this.requireTenant(tenantId);
    const location = await this.businessesService.assertLocationBelongsToTenant(
      dto.businessLocationId,
      tenantId,
    );
    assertFacilityTypeAllowedForLocation(location, 'cricket');

    let timeSlotTemplateId: string | null = null;
    if (dto.timeSlotTemplateId) {
      await this.timeSlotTemplates.assertBelongsToTenant(
        tenantId,
        dto.timeSlotTemplateId,
      );
      timeSlotTemplateId = dto.timeSlotTemplateId;
    }

    const row = this.repo.create({
      tenantId,
      businessLocationId: dto.businessLocationId,
      name: dto.name,
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
      cricketFormat: dto.cricketFormat,
      cricketStumpsAvailable: dto.cricketStumpsAvailable,
      cricketBowlingMachine: dto.cricketBowlingMachine,
      cricketPracticeMode: dto.cricketPracticeMode,
      pricePerSlot: dec(dto.pricePerSlot),
      peakPricing: dto.peakPricing,
      discountMembership: dto.discountMembership,
      slotDurationMinutes: dto.slotDurationMinutes,
      bufferBetweenSlotsMinutes: dto.bufferBetweenSlotsMinutes,
      allowParallelBooking: dto.allowParallelBooking,
      amenities: dto.amenities,
      rules: dto.rules,
      timeSlotTemplateId,
    });
    return this.repo.save(row);
  }

  async findOne(tenantId: string, id: string): Promise<CricketCourt> {
    this.requireTenant(tenantId);
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (row) return row;
    const dual = await this.futsalRepo.findOne({
      where: { id, tenantId, supportsCricket: true },
    });
    if (!dual) {
      throw new NotFoundException(`Cricket court ${id} not found`);
    }
    return futsalDualTurfAsCricketCourt(dual);
  }

  /**
   * Public read by court UUID only (no `X-Tenant-Id`). Same row shape as {@link findOne};
   * only **active** courts are returned.
   */
  async findOnePublicById(id: string): Promise<CricketCourt> {
    const row = await this.repo.findOne({
      where: { id },
      relations: ['businessLocation'],
    });
    if (row && row.courtStatus === 'active') {
      return row;
    }
    const dual = await this.futsalRepo.findOne({
      where: { id, supportsCricket: true },
      relations: ['businessLocation'],
    });
    if (!dual || dual.courtStatus !== 'active') {
      throw new NotFoundException(`Cricket court ${id} not found`);
    }
    return futsalDualTurfAsCricketCourt(dual);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateCricketCourtDto,
  ): Promise<CricketCourt> {
    this.requireTenant(tenantId);
    const cricketRow = await this.repo.findOne({ where: { id, tenantId } });

    if (dto.businessLocationId !== undefined) {
      const location =
        await this.businessesService.assertLocationBelongsToTenant(
          dto.businessLocationId,
          tenantId,
        );
      assertFacilityTypeAllowedForLocation(location, 'cricket');
    }

    const assign = <T extends CricketCourt | FutsalCourt, K extends keyof T>(
      target: Partial<T>,
      key: K,
      val: T[K],
    ) => {
      if (val !== undefined)
        (target as Record<string, unknown>)[key as string] = val;
    };

    if (cricketRow) {
      const patch: Partial<CricketCourt> = {};
      if (dto.name !== undefined) assign(patch, 'name', dto.name);
      if (dto.businessLocationId !== undefined)
        assign(patch, 'businessLocationId', dto.businessLocationId);
      if (dto.arenaLabel !== undefined) assign(patch, 'arenaLabel', dto.arenaLabel);
      if (dto.courtStatus !== undefined)
        assign(patch, 'courtStatus', dto.courtStatus);
      if (dto.imageUrls !== undefined) assign(patch, 'imageUrls', dto.imageUrls);
      if (dto.ceilingHeightValue !== undefined)
        assign(patch, 'ceilingHeightValue', dec(dto.ceilingHeightValue));
      if (dto.ceilingHeightUnit !== undefined)
        assign(patch, 'ceilingHeightUnit', dto.ceilingHeightUnit);
      if (dto.coveredType !== undefined)
        assign(patch, 'coveredType', dto.coveredType);
      if (dto.sideNetting !== undefined)
        assign(patch, 'sideNetting', dto.sideNetting);
      if (dto.netHeight !== undefined) assign(patch, 'netHeight', dto.netHeight);
      if (dto.boundaryType !== undefined)
        assign(patch, 'boundaryType', dto.boundaryType);
      if (dto.ventilation !== undefined)
        assign(patch, 'ventilation', dto.ventilation);
      if (dto.lighting !== undefined) assign(patch, 'lighting', dto.lighting);
      if (dto.lengthM !== undefined) assign(patch, 'lengthM', dec(dto.lengthM));
      if (dto.widthM !== undefined) assign(patch, 'widthM', dec(dto.widthM));
      if (dto.surfaceType !== undefined)
        assign(patch, 'surfaceType', dto.surfaceType);
      if (dto.turfQuality !== undefined)
        assign(patch, 'turfQuality', dto.turfQuality);
      if (dto.shockAbsorptionLayer !== undefined)
        assign(patch, 'shockAbsorptionLayer', dto.shockAbsorptionLayer);
      if (dto.cricketFormat !== undefined)
        assign(patch, 'cricketFormat', dto.cricketFormat);
      if (dto.cricketStumpsAvailable !== undefined)
        assign(patch, 'cricketStumpsAvailable', dto.cricketStumpsAvailable);
      if (dto.cricketBowlingMachine !== undefined)
        assign(patch, 'cricketBowlingMachine', dto.cricketBowlingMachine);
      if (dto.cricketPracticeMode !== undefined)
        assign(patch, 'cricketPracticeMode', dto.cricketPracticeMode);
      if (dto.pricePerSlot !== undefined)
        assign(patch, 'pricePerSlot', dec(dto.pricePerSlot));
      if (dto.peakPricing !== undefined) assign(patch, 'peakPricing', dto.peakPricing);
      if (dto.discountMembership !== undefined)
        assign(patch, 'discountMembership', dto.discountMembership);
      if (dto.slotDurationMinutes !== undefined)
        assign(patch, 'slotDurationMinutes', dto.slotDurationMinutes);
      if (dto.bufferBetweenSlotsMinutes !== undefined)
        assign(
          patch,
          'bufferBetweenSlotsMinutes',
          dto.bufferBetweenSlotsMinutes,
        );
      if (dto.allowParallelBooking !== undefined)
        assign(patch, 'allowParallelBooking', dto.allowParallelBooking);
      if (dto.amenities !== undefined) assign(patch, 'amenities', dto.amenities);
      if (dto.rules !== undefined) assign(patch, 'rules', dto.rules);
      if (dto.timeSlotTemplateId !== undefined) {
        if (dto.timeSlotTemplateId) {
          await this.timeSlotTemplates.assertBelongsToTenant(
            tenantId,
            dto.timeSlotTemplateId,
          );
          assign(patch, 'timeSlotTemplateId', dto.timeSlotTemplateId);
        } else {
          cricketRow.timeSlotTemplateId = null;
        }
      }
      Object.assign(cricketRow, patch);
      return this.repo.save(cricketRow);
    }

    const dual = await this.futsalRepo.findOne({
      where: { id, tenantId, supportsCricket: true },
    });
    if (!dual) {
      throw new NotFoundException(`Cricket court ${id} not found`);
    }

    if (dto.businessLocationId !== undefined) {
      const location =
        await this.businessesService.assertLocationBelongsToTenant(
          dto.businessLocationId,
          tenantId,
        );
      assertFacilityTypeAllowedForLocation(location, 'futsal');
    }

    const patch: Partial<FutsalCourt> = {};
    if (dto.name !== undefined) assign(patch, 'name', dto.name);
    if (dto.businessLocationId !== undefined)
      assign(patch, 'businessLocationId', dto.businessLocationId);
    if (dto.arenaLabel !== undefined) assign(patch, 'arenaLabel', dto.arenaLabel);
    if (dto.courtStatus !== undefined) assign(patch, 'courtStatus', dto.courtStatus);
    if (dto.imageUrls !== undefined) assign(patch, 'imageUrls', dto.imageUrls);
    if (dto.ceilingHeightValue !== undefined)
      assign(patch, 'ceilingHeightValue', dec(dto.ceilingHeightValue));
    if (dto.ceilingHeightUnit !== undefined)
      assign(patch, 'ceilingHeightUnit', dto.ceilingHeightUnit);
    if (dto.coveredType !== undefined) assign(patch, 'coveredType', dto.coveredType);
    if (dto.sideNetting !== undefined) assign(patch, 'sideNetting', dto.sideNetting);
    if (dto.netHeight !== undefined) assign(patch, 'netHeight', dto.netHeight);
    if (dto.boundaryType !== undefined)
      assign(patch, 'boundaryType', dto.boundaryType);
    if (dto.ventilation !== undefined) assign(patch, 'ventilation', dto.ventilation);
    if (dto.lighting !== undefined) assign(patch, 'lighting', dto.lighting);
    if (dto.lengthM !== undefined) assign(patch, 'lengthM', dec(dto.lengthM));
    if (dto.widthM !== undefined) assign(patch, 'widthM', dec(dto.widthM));
    if (dto.surfaceType !== undefined) assign(patch, 'surfaceType', dto.surfaceType);
    if (dto.turfQuality !== undefined) assign(patch, 'turfQuality', dto.turfQuality);
    if (dto.shockAbsorptionLayer !== undefined)
      assign(patch, 'shockAbsorptionLayer', dto.shockAbsorptionLayer);
    if (dto.cricketFormat !== undefined)
      assign(patch, 'cricketFormat', dto.cricketFormat);
    if (dto.cricketStumpsAvailable !== undefined)
      assign(patch, 'cricketStumpsAvailable', dto.cricketStumpsAvailable);
    if (dto.cricketBowlingMachine !== undefined)
      assign(patch, 'cricketBowlingMachine', dto.cricketBowlingMachine);
    if (dto.cricketPracticeMode !== undefined)
      assign(patch, 'cricketPracticeMode', dto.cricketPracticeMode);
    if (dto.pricePerSlot !== undefined)
      assign(patch, 'pricePerSlot', dec(dto.pricePerSlot));
    if (dto.peakPricing !== undefined) assign(patch, 'peakPricing', dto.peakPricing);
    if (dto.discountMembership !== undefined)
      assign(patch, 'discountMembership', dto.discountMembership);
    if (dto.slotDurationMinutes !== undefined)
      assign(patch, 'slotDurationMinutes', dto.slotDurationMinutes);
    if (dto.bufferBetweenSlotsMinutes !== undefined)
      assign(
        patch,
        'bufferBetweenSlotsMinutes',
        dto.bufferBetweenSlotsMinutes,
      );
    if (dto.allowParallelBooking !== undefined)
      assign(patch, 'allowParallelBooking', dto.allowParallelBooking);
    if (dto.amenities !== undefined) assign(patch, 'amenities', dto.amenities);
    if (dto.rules !== undefined) assign(patch, 'rules', dto.rules);
    if (dto.timeSlotTemplateId !== undefined) {
      if (dto.timeSlotTemplateId) {
        await this.timeSlotTemplates.assertBelongsToTenant(
          tenantId,
          dto.timeSlotTemplateId,
        );
        assign(patch, 'timeSlotTemplateId', dto.timeSlotTemplateId);
      } else {
        dual.timeSlotTemplateId = null;
      }
    }

    Object.assign(dual, patch);
    const saved = await this.futsalRepo.save(dual);
    return futsalDualTurfAsCricketCourt(saved);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    this.requireTenant(tenantId);
    const cricketRow = await this.repo.findOne({ where: { id, tenantId } });
    if (cricketRow) {
      await this.repo.remove(cricketRow);
      return;
    }
    const dual = await this.futsalRepo.findOne({
      where: { id, tenantId, supportsCricket: true },
    });
    if (!dual) {
      throw new NotFoundException(`Cricket court ${id} not found`);
    }
    await this.futsalRepo.remove(dual);
  }
}
