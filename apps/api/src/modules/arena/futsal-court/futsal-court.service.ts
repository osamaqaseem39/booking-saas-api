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
import { ArenaTurfTwinLinkService } from '../arena-turf-twin-link.service';
import { assertFacilityTypeAllowedForLocation } from '../location-facility.util';
import { CreateFutsalCourtDto } from './dto/create-futsal-court.dto';
import { UpdateFutsalCourtDto } from './dto/update-futsal-court.dto';
import { FutsalCourt } from './entities/futsal-court.entity';

function dec(n?: number): string | undefined {
  if (n === undefined || n === null || Number.isNaN(n)) return undefined;
  return String(n);
}

@Injectable()
export class FutsalCourtService {
  constructor(
    @InjectRepository(FutsalCourt)
    private readonly repo: Repository<FutsalCourt>,
    private readonly businessesService: BusinessesService,
    private readonly turfTwinLink: ArenaTurfTwinLinkService,
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
  ): Promise<FutsalCourt[]> {
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

  async create(tenantId: string, dto: CreateFutsalCourtDto): Promise<FutsalCourt> {
    this.requireTenant(tenantId);
    const location = await this.businessesService.assertLocationBelongsToTenant(
      dto.businessLocationId,
      tenantId,
    );
    assertFacilityTypeAllowedForLocation(location, 'futsal');

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
      futsalFormat: dto.futsalFormat,
      futsalGoalPostsAvailable: dto.futsalGoalPostsAvailable,
      futsalGoalPostSize: dto.futsalGoalPostSize,
      futsalLineMarkings: dto.futsalLineMarkings,
      pricePerSlot: dec(dto.pricePerSlot),
      peakPricing: dto.peakPricing,
      discountMembership: dto.discountMembership,
      slotDurationMinutes: dto.slotDurationMinutes,
      bufferBetweenSlotsMinutes: dto.bufferBetweenSlotsMinutes,
      allowParallelBooking: dto.allowParallelBooking,
      amenities: dto.amenities,
      rules: dto.rules,
      linkedTwinCourtKind: dto.linkedTwinCourtKind,
      linkedTwinCourtId: dto.linkedTwinCourtId,
      timeSlotTemplateId,
    });
    const saved = await this.repo.save(row);
    await this.turfTwinLink.applyAfterFutsalSaved(tenantId, saved, null);
    return saved;
  }

  async findOne(tenantId: string, id: string): Promise<FutsalCourt> {
    this.requireTenant(tenantId);
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) {
      throw new NotFoundException(`Futsal court ${id} not found`);
    }
    return row;
  }

  /**
   * Public read by court UUID only (no `X-Tenant-Id`). Same row shape as {@link findOne};
   * only **active** courts are returned.
   */
  async findOnePublicById(id: string): Promise<FutsalCourt> {
    const row = await this.repo.findOne({
      where: { id },
      relations: ['businessLocation'],
    });
    if (!row || row.courtStatus !== 'active') {
      throw new NotFoundException(`Futsal court ${id} not found`);
    }
    return row;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateFutsalCourtDto,
  ): Promise<FutsalCourt> {
    const row = await this.findOne(tenantId, id);
    const previousTwinId = row.linkedTwinCourtId ?? null;

    if (dto.businessLocationId !== undefined) {
      const location = await this.businessesService.assertLocationBelongsToTenant(
        dto.businessLocationId,
        tenantId,
      );
      assertFacilityTypeAllowedForLocation(location, 'futsal');
    }

    const patch: Partial<FutsalCourt> = {};
    const assign = <K extends keyof FutsalCourt>(key: K, val: FutsalCourt[K]) => {
      if (val !== undefined)
        (patch as Record<string, unknown>)[key as string] = val;
    };

    if (dto.name !== undefined) assign('name', dto.name);
    if (dto.businessLocationId !== undefined)
      assign('businessLocationId', dto.businessLocationId);
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
    if (dto.futsalFormat !== undefined)
      assign('futsalFormat', dto.futsalFormat);
    if (dto.futsalGoalPostsAvailable !== undefined)
      assign('futsalGoalPostsAvailable', dto.futsalGoalPostsAvailable);
    if (dto.futsalGoalPostSize !== undefined)
      assign('futsalGoalPostSize', dto.futsalGoalPostSize);
    if (dto.futsalLineMarkings !== undefined)
      assign('futsalLineMarkings', dto.futsalLineMarkings);
    if (dto.pricePerSlot !== undefined)
      assign('pricePerSlot', dec(dto.pricePerSlot));
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
    if (dto.linkedTwinCourtKind !== undefined)
      assign('linkedTwinCourtKind', dto.linkedTwinCourtKind);
    if (dto.linkedTwinCourtId !== undefined)
      assign('linkedTwinCourtId', dto.linkedTwinCourtId);
    if (dto.timeSlotTemplateId !== undefined) {
      if (dto.timeSlotTemplateId) {
        await this.timeSlotTemplates.assertBelongsToTenant(
          tenantId,
          dto.timeSlotTemplateId,
        );
        assign('timeSlotTemplateId', dto.timeSlotTemplateId);
      } else {
        row.timeSlotTemplateId = null;
      }
    }

    Object.assign(row, patch);
    const saved = await this.repo.save(row);
    await this.turfTwinLink.applyAfterFutsalSaved(
      tenantId,
      saved,
      previousTwinId,
    );
    return saved;
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const row = await this.findOne(tenantId, id);
    await this.turfTwinLink.clearPartnerForDeletedFutsal(tenantId, row);
    await this.repo.remove(row);
  }

  async unlinkTwin(tenantId: string, id: string): Promise<FutsalCourt> {
    const row = await this.findOne(tenantId, id);
    const previousTwinId = row.linkedTwinCourtId ?? null;
    row.linkedTwinCourtKind = undefined;
    row.linkedTwinCourtId = undefined;
    const saved = await this.repo.save(row);
    await this.turfTwinLink.applyAfterFutsalSaved(tenantId, saved, previousTwinId);
    return saved;
  }
}
