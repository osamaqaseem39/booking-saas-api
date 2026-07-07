import { IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { WEEKDAY_KEYS } from '../types/time-slot-template.types';

const WEEKDAY_SET = new Set<string>(WEEKDAY_KEYS);

export class TimeSlotTemplateScheduleDto {
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID('4')
  sunday?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID('4')
  monday?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID('4')
  tuesday?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID('4')
  wednesday?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID('4')
  thursday?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID('4')
  friday?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID('4')
  saturday?: string | null;
}

export function normalizeTimeSlotTemplateSchedule(
  raw: unknown,
): Record<string, string | null> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = k.toLowerCase();
    if (!WEEKDAY_SET.has(key)) continue;
    if (v === null || v === '') {
      out[key] = null;
    } else if (typeof v === 'string' && v.trim()) {
      out[key] = v.trim();
    }
  }
  return Object.keys(out).length ? out : undefined;
}
