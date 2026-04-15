/**
 * Compatibility stub after hard-removing futsal feature routes/modules.
 * Kept only to satisfy historical references while cleanup continues.
 */
export class FutsalCourt {
  id!: string;
  tenantId!: string;
  businessLocationId?: string | null;
  name!: string;
  courtStatus!: string;
  supportsCricket?: boolean;
  linkedTwinCourtId?: string;
  linkedTwinCourtKind?: string;
  pricePerSlot?: string;
  slotDurationMinutes?: number | null;
  timeSlotTemplateId?: string | null;
}
