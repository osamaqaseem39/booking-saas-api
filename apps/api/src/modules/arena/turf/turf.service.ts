import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessesService } from '../../businesses/businesses.service';
import { TenantTimeSlotTemplate } from '../../bookings/entities/tenant-time-slot-template.entity';
import { TenantTimeSlotTemplateLine } from '../../bookings/entities/tenant-time-slot-template-line.entity';
import { CourtFacilitySlot } from '../../bookings/entities/court-facility-slot.entity';
import { TurfCourt } from './entities/turf-court.entity';
import type { TurfSportType } from './turf.types';

@Injectable()
export class TurfService {
  constructor(
    @InjectRepository(TurfCourt)
    private readonly turfRepo: Repository<TurfCourt>,
    @InjectRepository(TenantTimeSlotTemplate)
    private readonly timeSlotTemplateRepo: Repository<TenantTimeSlotTemplate>,
    @InjectRepository(TenantTimeSlotTemplateLine)
    private readonly timeSlotTemplateLineRepo: Repository<TenantTimeSlotTemplateLine>,
    @InjectRepository(CourtFacilitySlot)
    private readonly courtFacilitySlotRepo: Repository<CourtFacilitySlot>,
    private readonly businessesService: BusinessesService,
  ) {}

  private requireTenant(tenantId: string): void {
    if (!tenantId || tenantId === 'public') {
      throw new BadRequestException(
        'A valid business tenant is required (send x-tenant-id)',
      );
    }
  }

  private parseNum(value: unknown): string | undefined {
    if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
    return String(value);
  }

  private async resolveTimeSlotTemplateId(
    tenantId: string,
    raw: unknown,
  ): Promise<string | null | undefined> {
    if (raw === undefined) return undefined;
    if (raw === null || raw === '') return null;
    if (typeof raw !== 'string') {
      throw new BadRequestException('timeSlotTemplateId must be a UUID string');
    }
    const templateId = raw.trim();
    if (!templateId) return null;
    const row = await this.timeSlotTemplateRepo.findOne({
      where: { id: templateId, tenantId },
      select: { id: true },
    });
    if (!row) {
      throw new BadRequestException(
        'timeSlotTemplateId does not exist for this tenant',
      );
    }
    return templateId;
  }

  async listBySport(
    sportType: TurfSportType,
    branchId?: string,
  ): Promise<TurfCourt[]> {
    const qb = this.turfRepo
      .createQueryBuilder('t')
      .where(':sportType = ANY(t."supportedSports")', { sportType })
      .andWhere('t.status = :status', { status: 'active' })
      .orderBy('t.name', 'ASC');

    if (branchId) {
      qb.andWhere('t."branchId" = :branchId', { branchId });
    }
    return qb.getMany();
  }

  async listByTenant(
    tenantId: string,
    branchId?: string,
    sportType?: TurfSportType,
  ): Promise<TurfCourt[]> {
    if (!tenantId || tenantId === 'public') return [];
    const qb = this.turfRepo
      .createQueryBuilder('t')
      .where('t."tenantId" = :tenantId', { tenantId })
      .orderBy('t.name', 'ASC');
    if (branchId) {
      qb.andWhere('t."branchId" = :branchId', { branchId });
    }
    if (sportType) {
      qb.andWhere(':sportType = ANY(t."supportedSports")', { sportType });
    }
    return qb.getMany();
  }

  async createByTenant(
    tenantId: string,
    input: Record<string, unknown>,
  ): Promise<TurfCourt> {
    this.requireTenant(tenantId);

    const businessLocationId = String(input.businessLocationId ?? '').trim();
    const name = String(input.name ?? '').trim();
    if (!businessLocationId) {
      throw new BadRequestException('businessLocationId is required');
    }
    if (!name) {
      throw new BadRequestException('name is required');
    }

    await this.businessesService.assertLocationBelongsToTenant(
      businessLocationId,
      tenantId,
    );

    const hasFutsalHints =
      input.futsalFormat !== undefined ||
      input.futsalGoalPostsAvailable !== undefined ||
      input.futsalGoalPostSize !== undefined ||
      input.futsalLineMarkings !== undefined;
    const hasCricketHints =
      input.cricketFormat !== undefined ||
      input.cricketStumpsAvailable !== undefined ||
      input.cricketBowlingMachine !== undefined ||
      input.cricketPracticeMode !== undefined;
    const supportsCricket = input.supportsCricket === true;

    const supportedSports: TurfSportType[] = [];
    if (hasFutsalHints || (!hasCricketHints && !supportsCricket)) {
      supportedSports.push('futsal');
    }
    if (supportsCricket || hasCricketHints) {
      supportedSports.push('cricket');
    }

    const rawStatus = String(input.courtStatus ?? 'active').trim();
    const status =
      rawStatus === 'active' || rawStatus === 'maintenance'
        ? rawStatus
        : 'active';

    const rawCoveredType = String(input.coveredType ?? 'open').trim();
    const coveredType =
      rawCoveredType === 'open' ||
      rawCoveredType === 'semi_covered' ||
      rawCoveredType === 'indoor'
        ? rawCoveredType
        : rawCoveredType === 'fully_indoor'
          ? 'indoor'
          : 'open';

    const row = this.turfRepo.create({
      tenantId,
      branchId: businessLocationId,
      name,
      status,
      length: this.parseNum(input.lengthM),
      width: this.parseNum(input.widthM),
      ceilingHeight: this.parseNum(input.ceilingHeightValue),
      coveredType,
      surfaceType:
        typeof input.surfaceType === 'string' ? input.surfaceType : undefined,
      turfQuality:
        typeof input.turfQuality === 'string' ? input.turfQuality : undefined,
      supportedSports,
      sportConfig: this.calculateSportConfig(supportedSports, input),
      pricing: this.calculatePricing(supportedSports, input),
      slotDuration:
        typeof input.slotDurationMinutes === 'number'
          ? input.slotDurationMinutes
          : 60,
      bufferTime:
        typeof input.bufferBetweenSlotsMinutes === 'number'
          ? input.bufferBetweenSlotsMinutes
          : 0,
      timeSlotTemplateId:
        (await this.resolveTimeSlotTemplateId(
          tenantId,
          input.timeSlotTemplateId,
        )) ?? null,
    });

    const saved = await this.turfRepo.save(row);

    if (saved.timeSlotTemplateId) {
      await this.syncSlotsFromTemplate(tenantId, saved);
    }

    return saved;
  }

  async findOneByTenant(tenantId: string, id: string): Promise<TurfCourt> {
    this.requireTenant(tenantId);
    const row = await this.turfRepo.findOne({ where: { id, tenantId } });
    if (!row) {
      throw new NotFoundException(`Turf court ${id} not found`);
    }
    return row;
  }

  async updateByTenant(
    tenantId: string,
    id: string,
    input: Record<string, unknown>,
  ): Promise<TurfCourt> {
    const row = await this.findOneByTenant(tenantId, id);

    if (typeof input.name === 'string' && input.name.trim()) {
      row.name = input.name.trim();
    }

    if (
      typeof input.businessLocationId === 'string' &&
      input.businessLocationId.trim()
    ) {
      const businessLocationId = input.businessLocationId.trim();
      await this.businessesService.assertLocationBelongsToTenant(
        businessLocationId,
        tenantId,
      );
      row.branchId = businessLocationId;
    }

    if (typeof input.courtStatus === 'string') {
      const courtStatus = input.courtStatus.trim();
      if (courtStatus === 'active' || courtStatus === 'maintenance') {
        row.status = courtStatus;
      }
    }
    if (typeof input.status === 'string') {
      const status = input.status.trim();
      if (status === 'active' || status === 'maintenance') {
        row.status = status;
      }
    }

    if (input.lengthM !== undefined) row.length = this.parseNum(input.lengthM);
    if (input.widthM !== undefined) row.width = this.parseNum(input.widthM);
    if (input.ceilingHeightValue !== undefined) {
      row.ceilingHeight = this.parseNum(input.ceilingHeightValue);
    }

    if (typeof input.coveredType === 'string') {
      const ct = input.coveredType.trim();
      if (ct === 'open' || ct === 'semi_covered' || ct === 'indoor') {
        row.coveredType = ct;
      } else if (ct === 'fully_indoor') {
        row.coveredType = 'indoor';
      }
    }

    if (typeof input.surfaceType === 'string')
      row.surfaceType = input.surfaceType;
    if (typeof input.turfQuality === 'string')
      row.turfQuality = input.turfQuality;

    if (
      input.slotDurationMinutes !== undefined &&
      typeof input.slotDurationMinutes === 'number'
    ) {
      row.slotDuration = input.slotDurationMinutes;
    }
    if (
      input.bufferBetweenSlotsMinutes !== undefined &&
      typeof input.bufferBetweenSlotsMinutes === 'number'
    ) {
      row.bufferTime = input.bufferBetweenSlotsMinutes;
    }

    const nextTemplateId = await this.resolveTimeSlotTemplateId(
      tenantId,
      input.timeSlotTemplateId,
    );
    if (nextTemplateId !== undefined) {
      row.timeSlotTemplateId = nextTemplateId;
    }

    // Update sports types if provided (though UI typically prevents this for existing courts)
    if (Array.isArray(input.supportedSports) && input.supportedSports.length > 0) {
      row.supportedSports = input.supportedSports as TurfSportType[];
    } else if (input.supportsCricket === true && !row.supportedSports.includes('cricket')) {
      row.supportedSports = [...row.supportedSports, 'cricket'];
    }

    // Always recalculate config/pricing if hints are provided or explicitly requested
    const hasFutsalHints =
      input.futsalFormat !== undefined ||
      input.futsalGoalPostsAvailable !== undefined ||
      input.futsalGoalPostSize !== undefined ||
      input.futsalLineMarkings !== undefined;
    const hasCricketHints =
      input.cricketFormat !== undefined ||
      input.cricketStumpsAvailable !== undefined ||
      input.cricketBowlingMachine !== undefined ||
      input.cricketPracticeMode !== undefined;
    const hasPricingHints =
      input.pricePerSlot !== undefined || input.peakPricing !== undefined;

    const hasCommonHints =
      input.imageUrls !== undefined ||
      input.arenaLabel !== undefined ||
      input.ceilingHeightUnit !== undefined ||
      input.sideNetting !== undefined ||
      input.netHeight !== undefined ||
      input.boundaryType !== undefined ||
      input.ventilation !== undefined ||
      input.lighting !== undefined ||
      input.shockAbsorptionLayer !== undefined ||
      input.discountMembership !== undefined ||
      input.amenities !== undefined ||
      input.rules !== undefined ||
      input.allowParallelBooking !== undefined;

    if (hasFutsalHints || hasCricketHints || hasCommonHints) {
      row.sportConfig = this.calculateSportConfig(row.supportedSports, {
        ...(row.sportConfig as any),
        ...input,
      });
    }
    if (hasPricingHints) {
      row.pricing = this.calculatePricing(row.supportedSports, {
        ...(row.pricing as any),
        ...input,
      });
    }

    const saved = await this.turfRepo.save(row);
    if (input.timeSlotTemplateId !== undefined && saved.timeSlotTemplateId) {
      await this.syncSlotsFromTemplate(tenantId, saved);
    }
    return saved;
  }

  async removeByTenant(
    tenantId: string,
    id: string,
  ): Promise<{ deleted: true; id: string }> {
    const row = await this.findOneByTenant(tenantId, id);
    await this.turfRepo.remove(row);
    return { deleted: true, id };
  }

  private async syncSlotsFromTemplate(
    tenantId: string,
    court: TurfCourt,
  ): Promise<void> {
    if (!court.timeSlotTemplateId) return;
    const lines = await this.timeSlotTemplateLineRepo.find({
      where: { templateId: court.timeSlotTemplateId, tenantId },
    });
    if (!lines.length) return;

    const values: Partial<CourtFacilitySlot>[] = [];
    const d = new Date();
    for (let i = 0; i < 30; i++) {
      const slotDate = new Date(d);
      slotDate.setUTCDate(slotDate.getUTCDate() + i);
      const dateStr = slotDate.toISOString().slice(0, 10);
      for (const line of lines) {
        values.push({
          tenantId,
          courtKind: 'turf_court',
          courtId: court.id,
          slotDate: dateStr,
          startTime: line.startTime,
          endTime: line.endTime,
          status: line.status as any,
        });
      }
    }
    await this.courtFacilitySlotRepo
      .createQueryBuilder()
      .insert()
      .into(CourtFacilitySlot)
      .values(values as CourtFacilitySlot[])
      .orIgnore()
      .execute();
  }

  private calculateSportConfig(
    supportedSports: TurfSportType[],
    input: Record<string, unknown>,
  ) {
    return {
      futsal: supportedSports.includes('futsal')
        ? {
            format:
              typeof input.futsalFormat === 'string'
                ? input.futsalFormat
                : undefined,
            goalPostAvailable:
              typeof input.futsalGoalPostsAvailable === 'boolean'
                ? input.futsalGoalPostsAvailable
                : undefined,
            goalPostSize:
              typeof input.futsalGoalPostSize === 'string'
                ? input.futsalGoalPostSize
                : undefined,
            lineMarkings:
              typeof input.futsalLineMarkings === 'string'
                ? input.futsalLineMarkings
                : undefined,
          }
        : undefined,
      cricket: supportedSports.includes('cricket')
        ? {
            type:
              typeof input.cricketFormat === 'string'
                ? input.cricketFormat
                : undefined,
            stumpsAvailable:
              typeof input.cricketStumpsAvailable === 'boolean'
                ? input.cricketStumpsAvailable
                : undefined,
            bowlingMachine:
              typeof input.cricketBowlingMachine === 'boolean'
                ? input.cricketBowlingMachine
                : undefined,
          }
        : undefined,
      common: {
        imageUrls: Array.isArray(input.imageUrls)
          ? (input.imageUrls as string[])
          : (input as any).common?.imageUrls,
        arenaLabel:
          typeof input.arenaLabel === 'string'
            ? input.arenaLabel
            : (input as any).common?.arenaLabel,
        ceilingHeightUnit:
          typeof input.ceilingHeightUnit === 'string'
            ? input.ceilingHeightUnit
            : (input as any).common?.ceilingHeightUnit,
        sideNetting:
          typeof input.sideNetting === 'boolean'
            ? input.sideNetting
            : (input as any).common?.sideNetting,
        netHeight:
          typeof input.netHeight === 'string'
            ? input.netHeight
            : (input as any).common?.netHeight,
        boundaryType:
          typeof input.boundaryType === 'string'
            ? input.boundaryType
            : (input as any).common?.boundaryType,
        ventilation: Array.isArray(input.ventilation)
          ? (input.ventilation as string[])
          : (input as any).common?.ventilation,
        lighting:
          typeof input.lighting === 'string'
            ? input.lighting
            : (input as any).common?.lighting,
        shockAbsorptionLayer:
          typeof input.shockAbsorptionLayer === 'boolean'
            ? input.shockAbsorptionLayer
            : (input as any).common?.shockAbsorptionLayer,
        discountMembership:
          input.discountMembership !== undefined
            ? input.discountMembership
            : (input as any).common?.discountMembership,
        amenities:
          input.amenities !== undefined
            ? input.amenities
            : (input as any).common?.amenities,
        rules:
          input.rules !== undefined
            ? input.rules
            : (input as any).common?.rules,
        allowParallelBooking:
          typeof input.allowParallelBooking === 'boolean'
            ? input.allowParallelBooking
            : (input as any).common?.allowParallelBooking,
      },
    };
  }

  private calculatePricing(
    supportedSports: TurfSportType[],
    input: Record<string, unknown>,
  ) {
    const base =
      typeof input.pricePerSlot === 'number' ? input.pricePerSlot : undefined;
    const peakPricing =
      input.peakPricing && typeof input.peakPricing === 'object'
        ? (input.peakPricing as {
            weekdayEvening?: unknown;
            weekend?: unknown;
          })
        : undefined;

    if (base === undefined && !peakPricing) return undefined;

    return {
      futsal: supportedSports.includes('futsal')
        ? {
            basePrice: base,
            peakPrice:
              typeof peakPricing?.weekdayEvening === 'number'
                ? peakPricing.weekdayEvening
                : undefined,
            weekendPrice:
              typeof peakPricing?.weekend === 'number'
                ? peakPricing.weekend
                : undefined,
          }
        : undefined,
      cricket: supportedSports.includes('cricket')
        ? {
            basePrice: base,
            peakPrice:
              typeof peakPricing?.weekdayEvening === 'number'
                ? peakPricing.weekdayEvening
                : undefined,
            weekendPrice:
              typeof peakPricing?.weekend === 'number'
                ? peakPricing.weekend
                : undefined,
          }
        : undefined,
    };
  }
}
