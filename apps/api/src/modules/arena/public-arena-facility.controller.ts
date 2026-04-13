import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { CricketCourt } from './cricket-court/entities/cricket-court.entity';
import { CricketCourtService } from './cricket-court/cricket-court.service';
import { FutsalCourt } from './futsal-court/entities/futsal-court.entity';
import { FutsalCourtService } from './futsal-court/futsal-court.service';
import { PadelCourt } from './padel-court/entities/padel-court.entity';
import { PadelCourtService } from './padel-court/padel-court.service';

/**
 * Public facility detail by court id — no auth, no `X-Tenant-Id`.
 * Mirrors tenant routes: `GET /arena/futsal-courts/:id`, `GET /arena/cricket-courts/:id`,
 * `GET /arena/padel-court/:id` but resolves by UUID only. `tenantId` is omitted from JSON;
 * use `businessLocationId` + **GET /public/venues/:id** when you need the tenant for booking APIs.
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
  async getCricketCourtPublic(@Param('courtId', ParseUUIDPipe) courtId: string) {
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
    const { tenantId: _omit, ...rest } = row;
    return rest as Record<string, unknown>;
  }
}
