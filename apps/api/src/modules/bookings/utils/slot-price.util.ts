import type { SlotPriceTier } from '../types/time-slot-template.types';
import { weekdayKeyFromYmd } from './time-slot-template-schedule.util';

export type PeakPricingLike = {
  weekdayEvening?: number;
  weekend?: number;
} | null | undefined;

export function resolveSlotPrice(params: {
  date: string;
  priceTier: SlotPriceTier;
  basePrice?: number | null;
  peakPricing?: PeakPricingLike;
}): number {
  const base = params.basePrice ?? 0;
  if (params.priceTier !== 'peak') return base;

  const dayKey = weekdayKeyFromYmd(params.date);
  const isWeekend = dayKey === 'saturday' || dayKey === 'sunday';
  const peak = params.peakPricing;
  if (isWeekend && typeof peak?.weekend === 'number') return peak.weekend;
  if (!isWeekend && typeof peak?.weekdayEvening === 'number') {
    return peak.weekdayEvening;
  }
  return base;
}
