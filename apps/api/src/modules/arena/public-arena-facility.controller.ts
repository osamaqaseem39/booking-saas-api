import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { CricketCourt } from './cricket-court/entities/cricket-court.entity';
import { CricketCourtService } from './cricket-court/cricket-court.service';
import { FutsalCourt } from './futsal-court/entities/futsal-court.entity';
import { FutsalCourtService } from './futsal-court/futsal-court.service';
import { PadelCourt } from './padel-court/entities/padel-court.entity';
import { PadelCourtService } from './padel-court/padel-court.service';

/**
 * Public facility detail by court id — no auth, no `X-Tenant-Id`.
 * Mirrors tenant routes: `GET /arena/futsal-courts/:id`, `GET /arena/cricket-courts/:id`,
 * `GET /arena/padel-court/:id` but resolves by UUID only. `tenantId` is omitted from JSON.
 * Includes `location` (id, name, `about` from site details, address) when the court is linked to a site;
 * use **GET /public/venues/:id** when you need full venue payload and tenant id for booking APIs.
 */
@Controller('public')
export class PublicArenaFacilityController {
  constructor(
    private readonly futsalCourtService: FutsalCourtService,
    private readonly cricketCourtService: CricketCourtService,
    private readonly padelCourtService: PadelCourtService,
  ) {}

  @Get('futsal-courts/:courtId')
  async getFutsalCourtPublic(@Param('courtId', ParseUUIDPipe) courtId: string) {
    const row = await this.futsalCourtService.findOnePublicById(courtId);
    return this.withoutTenant(row);
  }

  @Get('cricket-courts/:courtId')
  async getCricketCourtPublic(
    @Param('courtId', ParseUUIDPipe) courtId: string,
  ) {
    const row = await this.cricketCourtService.findOnePublicById(courtId);
    return this.withoutTenant(row);
  }

  @Get('padel-court/:courtId')
  async getPadelCourtPublic(@Param('courtId', ParseUUIDPipe) courtId: string) {
    const row = await this.padelCourtService.findOnePublicById(courtId);
    return this.withoutTenant(row);
  }

  private withoutTenant(
    row: FutsalCourt | CricketCourt | PadelCourt,
  ): Record<string, unknown> {
    const { tenantId: _omit, businessLocation: loc, ...court } = row;
    const location = this.publicLocationSummary(loc);
    return {
      ...court,
      ...(location ? { location } : {}),
    };
  }

  /** Listing-safe subset; `about` is {@link BusinessLocation.details} (venue description). */
  private publicLocationSummary(
    loc: BusinessLocation | null | undefined,
  ): Record<string, unknown> | null {
    if (!loc) return null;
    return {
      id: loc.id,
      name: loc.name,
      about: loc.details ?? null,
      addressLine: loc.addressLine ?? null,
      city: loc.city ?? null,
      area: loc.area ?? null,
      country: loc.country ?? null,
    };
  }
}
