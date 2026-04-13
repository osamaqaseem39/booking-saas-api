import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CreateTimeSlotTemplateDto } from './dto/create-time-slot-template.dto';
import type { UpdateTimeSlotTemplateDto } from './dto/update-time-slot-template.dto';
import { TenantTimeSlotTemplate } from './entities/tenant-time-slot-template.entity';

function toMinutes(time: string): number {
  if (time === '24:00') return 24 * 60;
  const [hRaw, mRaw] = time.split(':');
  const h = Number(hRaw || 0);
  const m = Number(mRaw || 0);
  return h * 60 + m;
}

function minutesToLabel(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export type TimeSlotTemplateApiRow = {
  id: string;
  name: string;
  slotStarts: string[];
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class TimeSlotTemplatesService {
  constructor(
    @InjectRepository(TenantTimeSlotTemplate)
    private readonly repo: Repository<TenantTimeSlotTemplate>,
  ) {}

  normalizeSlotStarts(raw: string[]): string[] {
    const seen = new Set<number>();
    const out: number[] = [];
    for (const s of raw) {
      const t = String(s).trim();
      if (!t) continue;
      const m = toMinutes(t);
      if (m < 0 || m >= 24 * 60) {
        throw new BadRequestException(`Invalid slot start time: ${t}`);
      }
      if (m % 30 !== 0) {
        throw new BadRequestException(
          `Slot starts must fall on 30-minute boundaries: ${t}`,
        );
      }
      if (seen.has(m)) continue;
      seen.add(m);
      out.push(m);
    }
    out.sort((a, b) => a - b);
    if (!out.length) {
      throw new BadRequestException('At least one valid slot start is required');
    }
    return out.map(minutesToLabel);
  }

  async assertBelongsToTenant(
    tenantId: string,
    templateId: string,
  ): Promise<TenantTimeSlotTemplate> {
    const row = await this.repo.findOne({
      where: { id: templateId, tenantId },
    });
    if (!row) {
      throw new BadRequestException(
        'timeSlotTemplateId does not exist for this tenant',
      );
    }
    return row;
  }

  async list(tenantId: string): Promise<TimeSlotTemplateApiRow[]> {
    const rows = await this.repo.find({
      where: { tenantId },
      order: { name: 'ASC' },
    });
    return rows.map((r) => this.toApiRow(r));
  }

  async create(
    tenantId: string,
    dto: CreateTimeSlotTemplateDto,
  ): Promise<TimeSlotTemplateApiRow> {
    const slotStarts = this.normalizeSlotStarts(dto.slotStarts);
    const saved = await this.repo.save(
      this.repo.create({
        tenantId,
        name: dto.name.trim(),
        slotStarts,
      }),
    );
    return this.toApiRow(saved);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateTimeSlotTemplateDto,
  ): Promise<TimeSlotTemplateApiRow> {
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) {
      throw new NotFoundException(`Time slot template ${id} not found`);
    }
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.slotStarts !== undefined) {
      row.slotStarts = this.normalizeSlotStarts(dto.slotStarts);
    }
    const saved = await this.repo.save(row);
    return this.toApiRow(saved);
  }

  async remove(tenantId: string, id: string): Promise<{ deleted: true; id: string }> {
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) {
      throw new NotFoundException(`Time slot template ${id} not found`);
    }
    await this.repo.remove(row);
    return { deleted: true, id };
  }

  private toApiRow(r: TenantTimeSlotTemplate): TimeSlotTemplateApiRow {
    return {
      id: r.id,
      name: r.name,
      slotStarts: Array.isArray(r.slotStarts) ? r.slotStarts : [],
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
