import { Controller, Get } from '@nestjs/common';
import { BusinessesService } from './businesses.service';

/**
 * End-user venue discovery.
 * - GET /getVenues — full rows (same as GET /businesses/locations).
 * - GET /getVenues/all|gaming|FutsalArenas — compact map-marker payloads.
 * - GET /getVenue/futsal|cricket|padel — same marker shape, filtered by sport facility counts.
 */
@Controller('getVenues')
export class GetVenuesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get()
  getVenues() {
    return this.businessesService.listAllLocationsPublic();
  }

  @Get('all')
  getVenuesAll() {
    return this.businessesService.listVenueMarkersPublic('all');
  }

  @Get('gaming')
  getVenuesGaming() {
    return this.businessesService.listVenueMarkersPublic('gaming');
  }

  @Get('FutsalArenas')
  getVenuesFutsalArenas() {
    return this.businessesService.listVenueMarkersPublic('FutsalArenas');
  }
}
