import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessesService } from '../../businesses/businesses.service';
import { TurfCourt } from './entities/turf-court.entity';
import type { TurfSportType } from './turf.types';

@Injectable()
export class TurfService {
  constructor(
    @InjectRepository(TurfCourt)
    private readonly turfRepo: Repository<TurfCourt>,
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
      rawStatus === 'active' || rawStatus === 'maintenance' ? rawStatus : 'active';

    const rawCoveredType = String(input.coveredType ?? 'open').trim();
    const coveredType =
      rawCoveredType === 'open' ||
      rawCoveredType === 'semi_covered' ||
      rawCoveredType === 'indoor'
        ? rawCoveredType
        : rawCoveredType === 'fully_indoor'
          ? 'indoor'
          : 'open';

    const pricing = (() => {
      const base = typeof input.pricePerSlot === 'number' ? input.pricePerSlot : undefined;
      const peakPricing =
        input.peakPricing && typeof input.peakPricing === 'object'
          ? (input.peakPricing as { weekdayEvening?: unknown; weekend?: unknown })
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
                typeof peakPricing?.weekend === 'number' ? peakPricing.weekend : undefined,
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
                typeof peakPricing?.weekend === 'number' ? peakPricing.weekend : undefined,
            }
          : undefined,
      };
    })();

    const sportConfig = {
      futsal: supportedSports.includes('futsal')
        ? {
            format:
              typeof input.futsalFormat === 'string' ? input.futsalFormat : undefined,
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
              typeof input.cricketFormat === 'string' ? input.cricketFormat : undefined,
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
    };

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
      sportConfig,
      pricing,
      slotDuration:
        typeof input.slotDurationMinutes === 'number' ? input.slotDurationMinutes : 60,
      bufferTime:
        typeof input.bufferBetweenSlotsMinutes === 'number'
          ? input.bufferBetweenSlotsMinutes
          : 0,
    });
    return this.turfRepo.save(row);
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

    if (typeof input.businessLocationId === 'string' && input.businessLocationId.trim()) {
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

    if (typeof input.surfaceType === 'string') row.surfaceType = input.surfaceType;
    if (typeof input.turfQuality === 'string') row.turfQuality = input.turfQuality;

    if (input.slotDurationMinutes !== undefined && typeof input.slotDurationMinutes === 'number') {
      row.slotDuration = input.slotDurationMinutes;
    }
    if (
      input.bufferBetweenSlotsMinutes !== undefined &&
      typeof input.bufferBetweenSlotsMinutes === 'number'
    ) {
      row.bufferTime = input.bufferBetweenSlotsMinutes;
    }

    return this.turfRepo.save(row);
  }

  async removeByTenant(
    tenantId: string,
    id: string,
  ): Promise<{ deleted: true; id: string }> {
    const row = await this.findOneByTenant(tenantId, id);
    await this.turfRepo.remove(row);
    return { deleted: true, id };
  }
}
