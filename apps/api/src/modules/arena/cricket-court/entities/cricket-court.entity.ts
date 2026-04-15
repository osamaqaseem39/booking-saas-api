/**
 * Compatibility stub after hard-removing cricket feature routes/modules.
 * Kept only to satisfy historical references while cleanup continues.
 */
export class CricketCourt {
  id!: string;
  tenantId!: string;
  businessLocationId?: string | null;
  name!: string;
  courtStatus!: string;
  linkedTwinCourtId?: string;
  linkedTwinCourtKind?: string;
  pricePerSlot?: string;
  slotDurationMinutes?: number | null;
  timeSlotTemplateId?: string | null;
}
