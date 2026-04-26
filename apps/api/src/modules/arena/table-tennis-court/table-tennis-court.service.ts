import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';
import { TimeSlotTemplatesService } from '../../bookings/time-slot-templates/time-slot-templates.service';
import { BusinessesService } from '../../businesses/businesses.service';
import { assertFacilityTypeAllowedForLocation } from '../utils/location-facility.util';
import { CreateTableTennisCourtDto } from './dto/create-table-tennis-court.dto';
import { UpdateTableTennisCourtDto } from './dto/update-table-tennis-court.dto';
import { TableTennisCourt } from './entities/table-tennis-court.entity';
import { TenantTimeSlotTemplateLine } from '../../bookings/entities/tenant-time-slot-template-line.entity';
import { CourtFacilitySlot } from '../../bookings/entities/court-facility-slot.entity';

const TABLE_TENNIS_FACILITY_CODE = 'table-tennis' as const;

function dec(n?: number): string | undefined {
  if (n === undefined || n === null || Number.isNaN(n)) return undefined;
  return String(n);
}

@Injectable()
export class TableTennisCourtService {
  constructor(
    @InjectRepository(TableTennisCourt)
    private readonly repo: Repository<TableTennisCourt>,
    @InjectRepository(TenantTimeSlotTemplateLine)
    private readonly lineRepo: Repository<TenantTimeSlotTemplateLine>,
    @InjectRepository(CourtFacilitySlot)
    private readonly slotRepo: Repository<CourtFacilitySlot>,
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
  ): Promise<TableTennisCourt[]> {
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
    dto: CreateTableTennisCourtDto,
  ): Promise<TableTennisCourt> {
    this.requireTenant(tenantId);
    const location = await this.businessesService.assertLocationBelongsToTenant(
      dto.businessLocationId,
      tenantId,
    );
    assertFacilityTypeAllowedForLocation(
      location,
      TABLE_TENNIS_FACILITY_CODE,
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
      courtStatus,
      description: dto.description,
      pricePerSlot: dec(dto.pricePerSlot),
      slotDurationMinutes: dto.slotDurationMinutes,
      bufferBetweenSlotsMinutes: dto.bufferBetweenSlotsMinutes,
      isActive,
      timeSlotTemplateId,
    });
    const saved = await this.repo.save(row);
    if (saved.timeSlotTemplateId) {
      await this.syncSlotsFromTemplate(tenantId, saved);
    }
    return saved;
  }

  async findOne(tenantId: string, id: string): Promise<TableTennisCourt> {
    this.requireTenant(tenantId);
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) {
      throw new NotFoundException(`Table tennis table ${id} not found`);
    }
    return row;
  }

  async findOnePublicById(id: string): Promise<TableTennisCourt> {
    const row = await this.repo.findOne({
      where: { id },
      relations: ['businessLocation'],
    });
    if (!row || !row.isActive || row.courtStatus !== 'active') {
      throw new NotFoundException(`Table tennis table ${id} not found`);
    }
    return row;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateTableTennisCourtDto,
  ): Promise<TableTennisCourt> {
    const row = await this.findOne(tenantId, id);

    if (dto.name !== undefined) row.name = dto.name;
    if (dto.description !== undefined) row.description = dto.description;
    if (dto.pricePerSlot !== undefined)
      row.pricePerSlot = dec(dto.pricePerSlot);
    if (dto.slotDurationMinutes !== undefined)
      row.slotDurationMinutes = dto.slotDurationMinutes;
    if (dto.bufferBetweenSlotsMinutes !== undefined)
      row.bufferBetweenSlotsMinutes = dto.bufferBetweenSlotsMinutes;
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

    const saved = await this.repo.save(row);
    if (dto.timeSlotTemplateId !== undefined && saved.timeSlotTemplateId) {
      await this.syncSlotsFromTemplate(tenantId, saved);
    }
    return saved;
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const row = await this.findOne(tenantId, id);
    await this.repo.remove(row);
  }

  private async syncSlotsFromTemplate(
    tenantId: string,
    court: TableTennisCourt,
  ): Promise<void> {
    if (!court.timeSlotTemplateId) return;
    const lines = await this.lineRepo.find({
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
          courtKind: 'table_tennis_court',
          courtId: court.id,
          slotDate: dateStr,
          startTime: line.startTime,
          endTime: line.endTime,
          status: line.status as any,
        });
      }
    }
    await this.slotRepo
      .createQueryBuilder()
      .insert()
      .into(CourtFacilitySlot)
      .values(values as CourtFacilitySlot[])
      .orIgnore()
      .execute();
  }
}
