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
import { TenantTimeSlotTemplateLine } from './entities/tenant-time-slot-template-line.entity';
import { COURT_SLOT_GRID_STEP_MINUTES } from './booking.types';

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
  slotLines: Array<{
    id: string;
    startTime: string;
    endTime: string;
    status: 'available' | 'blocked';
    sortOrder: number;
  }>;
  slotStarts: string[];
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class TimeSlotTemplatesService {
  constructor(
    @InjectRepository(TenantTimeSlotTemplate)
    private readonly templateRepo: Repository<TenantTimeSlotTemplate>,
    @InjectRepository(TenantTimeSlotTemplateLine)
    private readonly lineRepo: Repository<TenantTimeSlotTemplateLine>,
  ) {}

  private normalizeSlotStarts(raw: string[]): string[] {
    const seen = new Set<number>();
    const out: number[] = [];
    for (const s of raw) {
      const t = String(s).trim();
      if (!t) continue;
      const m = toMinutes(t);
      if (m < 0 || m >= 24 * 60) {
        throw new BadRequestException(`Invalid slot start time: ${t}`);
      }
      if (m % COURT_SLOT_GRID_STEP_MINUTES !== 0) {
        throw new BadRequestException(
          `Slot starts must fall on ${COURT_SLOT_GRID_STEP_MINUTES}-minute boundaries: ${t}`,
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

  private normalizeSlotLines(dto: CreateTimeSlotTemplateDto | UpdateTimeSlotTemplateDto): Array<{
    startTime: string;
    endTime: string;
    status: 'available' | 'blocked';
    sortOrder: number;
  }> {
    const hasLines = Array.isArray(dto.slotLines);
    const hasStarts = Array.isArray(dto.slotStarts);
    if (!hasLines && !hasStarts) {
      throw new BadRequestException('Either slotLines or slotStarts is required');
    }
    if (hasLines) {
      const rows: Array<{
        startTime: string;
        endTime: string;
        status: 'available' | 'blocked';
        sortOrder: number;
      }> = (dto.slotLines ?? []).map((line, idx) => {
        const startTime = String(line.startTime ?? '').trim();
        const endTime = String(line.endTime ?? '').trim();
        if (!startTime || !endTime) {
          throw new BadRequestException('Each slot line requires startTime and endTime');
        }
        const startMin = toMinutes(startTime);
        const endMin = toMinutes(endTime);
        if (startMin < 0 || startMin >= 24 * 60 || endMin <= 0 || endMin > 24 * 60) {
          throw new BadRequestException(
            `Invalid slot line time range: ${startTime}-${endTime}`,
          );
        }
        if (startMin % COURT_SLOT_GRID_STEP_MINUTES !== 0 || endMin % COURT_SLOT_GRID_STEP_MINUTES !== 0) {
          throw new BadRequestException(
            `Slot lines must follow ${COURT_SLOT_GRID_STEP_MINUTES}-minute boundaries`,
          );
        }
        if (endMin <= startMin) {
          throw new BadRequestException(`slot line endTime must be after startTime: ${startTime}`);
        }
        const status: 'available' | 'blocked' =
          line.status === 'blocked' ? 'blocked' : 'available';
        return {
          startTime: minutesToLabel(startMin),
          endTime: minutesToLabel(endMin),
          status,
          sortOrder: idx + 1,
        };
      });
      if (!rows.length) {
        throw new BadRequestException('At least one valid slot line is required');
      }
      return rows;
    }
    const starts = this.normalizeSlotStarts(dto.slotStarts ?? []);
    const startMinutes = starts.map((s) => toMinutes(s));
    const diffs = startMinutes
      .slice(1)
      .map((m, idx) => m - startMinutes[idx])
      .filter((d) => d > 0);
    const inferredDuration =
      diffs.length > 0
        ? Math.min(...diffs)
        : COURT_SLOT_GRID_STEP_MINUTES;
    return starts.map((startTime, idx) => {
      const start = toMinutes(startTime);
      const nextStart = startMinutes[idx + 1];
      const end = nextStart ?? start + inferredDuration;
      if (end <= start || end > 24 * 60) {
        throw new BadRequestException(
          `Could not infer valid endTime for slot start ${startTime}`,
        );
      }
      return {
        startTime,
        endTime: minutesToLabel(end),
        status: 'available' as const,
        sortOrder: idx + 1,
      };
    });
  }

  async assertBelongsToTenant(
    tenantId: string,
    templateId: string,
  ): Promise<TenantTimeSlotTemplate> {
    const row = await this.templateRepo.findOne({
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
    const rows = await this.templateRepo.find({
      where: { tenantId },
      relations: { slotLines: true },
      order: { name: 'ASC' },
    });
    return rows.map((r) => this.toApiRow(r));
  }

  async create(
    tenantId: string,
    dto: CreateTimeSlotTemplateDto,
  ): Promise<TimeSlotTemplateApiRow> {
    const slotLines = this.normalizeSlotLines(dto);
    const template = await this.templateRepo.save(
      this.templateRepo.create({
        tenantId,
        name: dto.name.trim(),
      }),
    );
    await this.lineRepo.save(
      slotLines.map((line) =>
        this.lineRepo.create({
          templateId: template.id,
          tenantId,
          startTime: line.startTime,
          endTime: line.endTime,
          status: line.status,
          sortOrder: line.sortOrder,
        }),
      ),
    );
    const saved = await this.templateRepo.findOne({
      where: { id: template.id, tenantId },
      relations: { slotLines: true },
    });
    if (!saved) throw new NotFoundException('Could not load saved template');
    return this.toApiRow(saved);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateTimeSlotTemplateDto,
  ): Promise<TimeSlotTemplateApiRow> {
    const row = await this.templateRepo.findOne({
      where: { id, tenantId },
      relations: { slotLines: true },
    });
    if (!row) {
      throw new NotFoundException(`Time slot template ${id} not found`);
    }
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.slotLines !== undefined || dto.slotStarts !== undefined) {
      const lines = this.normalizeSlotLines(dto);
      await this.lineRepo.delete({ templateId: row.id, tenantId });
      await this.lineRepo.save(
        lines.map((line) =>
          this.lineRepo.create({
            templateId: row.id,
            tenantId,
            startTime: line.startTime,
            endTime: line.endTime,
            status: line.status,
            sortOrder: line.sortOrder,
          }),
        ),
      );
    }
    await this.templateRepo.save(row);
    const saved = await this.templateRepo.findOne({
      where: { id: row.id, tenantId },
      relations: { slotLines: true },
    });
    if (!saved) throw new NotFoundException(`Time slot template ${id} not found`);
    return this.toApiRow(saved);
  }

  async remove(tenantId: string, id: string): Promise<{ deleted: true; id: string }> {
    const row = await this.templateRepo.findOne({ where: { id, tenantId } });
    if (!row) {
      throw new NotFoundException(`Time slot template ${id} not found`);
    }
    await this.templateRepo.remove(row);
    return { deleted: true, id };
  }

  private toApiRow(r: TenantTimeSlotTemplate): TimeSlotTemplateApiRow {
    const slotLines: TimeSlotTemplateApiRow['slotLines'] = (Array.isArray(r.slotLines) ? r.slotLines : [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((line) => ({
        id: line.id,
        startTime: line.startTime,
        endTime: line.endTime,
        status: line.status === 'blocked' ? 'blocked' : 'available',
        sortOrder: line.sortOrder,
      }));
    return {
      id: r.id,
      name: r.name,
      slotLines,
      slotStarts: slotLines.map((line) => line.startTime),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
