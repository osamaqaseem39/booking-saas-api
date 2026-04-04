import { Controller, Get } from '@nestjs/common';
import { BusinessesService } from './businesses.service';

/**
 * Map markers for venues that have at least one bookable court of the given sport
 * (from aggregated facility counts on each location).
 */
@Controller(['getVenue', 'getvenue'])
export class GetVenueSportController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get('futsal')
  getVenueFutsal() {
    return this.businessesService.listVenueMarkersPublic('futsal');
  }

  @Get('cricket')
  getVenueCricket() {
    return this.businessesService.listVenueMarkersPublic('cricket');
  }

  @Get('padel')
  getVenuePadel() {
    return this.businessesService.listVenueMarkersPublic('padel');
  }
}
