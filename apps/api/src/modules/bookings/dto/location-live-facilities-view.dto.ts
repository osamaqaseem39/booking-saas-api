import type { CourtKind } from '../types/booking.types';
import type { TurfCoveredType, TurfSportType } from '../../arena/turf/turf.types';
import type { FacilityPlaySnapshot } from '../utils/facility-live-snapshot.util';

export type { FacilityPlaySnapshot } from '../utils/facility-live-snapshot.util';

/** Padel row for the Live Facilities “catalog” strip (per venue). */
export type LivePadelCourtDto = {
  id: string;
  tenantId: string;
  businessLocationId: string | null;
  name: string;
  arenaLabel?: string | null;
  courtStatus: string;
  pricePerSlot: number;
  imageUrls?: string[] | null;
  slotDurationMinutes?: number | null;
  timeSlotTemplateId: string | null;
  isActive: boolean;
};

/** Turf row for futsal / cricket tabs (replaces multiple `GET /arena/turf-courts` calls). */
export type LiveTurfCourtDto = {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  status: string;
  supportedSports: TurfSportType[];
  length?: string | null;
  width?: string | null;
  coveredType: TurfCoveredType;
  surfaceType?: string | null;
  slotDuration: number;
  bufferTime: number;
  timeSlotTemplateId: string | null;
  /** Raw DB JSON (per-sport grid pricing). */
  pricing?: unknown;
  sportConfig?: unknown;
};

type FacilityDaySlots = {
  date: string;
  facilities: Array<{
    kind: CourtKind;
    courtId: string;
    name: string;
    price?: number;
    slots: Array<{
      startTime: string;
      endTime: string;
      availability: string;
    }>;
  }>;
  unionSlots: Array<{
    startTime: string;
    endTime: string;
    availability: string;
  }>;
};

/**
 * `liveSlots` matches `getLocationFacilitiesAvailableSlots` (per-court + union grid + next day).
 * Kept in sync with that method by convention.
 */
export type LiveFacilitiesSlotsPayload = {
  date: string;
  locationId: string;
  courtType: string;
  facilities: FacilityDaySlots['facilities'];
  unionSlots: FacilityDaySlots['unionSlots'];
  nextDateSlots: FacilityDaySlots;
  additionalDates: FacilityDaySlots[];
};

export type LocationLiveFacilitiesView = {
  locationId: string;
  /** ISO-8601 when the view was built (cache / debug). */
  generatedAt: string;
  /**
   * One row per physical court: current session (if any), next booking, and play status
   * (`live` / `soon` / `idle` / `inactive`), so the client does not have to recompute.
   */
  facilityPlayStatus: FacilityPlaySnapshot[];
  /** IANA time zone id used for “now” and booking window math (from location, default Asia/Karachi). */
  timeZone: string;
  /** All active padel courts for this business location. */
  padelCourts: LivePadelCourtDto[];
  /** Turf catalog split by sport (same as filtering `turf_courts` by supportedSports). */
  turfCourts: {
    futsal: LiveTurfCourtDto[];
    cricket: LiveTurfCourtDto[];
  };
  /**
   * Full slot state for the selected `date` (and time window) plus the next day preview.
   * Replaces a separate `GET .../available-slots` for this screen.
   */
  liveSlots: LiveFacilitiesSlotsPayload;
};
