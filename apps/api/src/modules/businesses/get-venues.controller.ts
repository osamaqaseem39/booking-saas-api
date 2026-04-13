import { Controller, Get, Query } from '@nestjs/common';
import { GetVenuesAllQueryDto } from './dto/get-venues-all-query.dto';
import { BusinessesService } from './businesses.service';

/**
 * End-user venue discovery.
 * - GET /getVenues — short map-marker list (same as `listVenueMarkersPublic('all')`).
 * - GET /getVenues/all — short map-marker list with optional filters, active only;
 *   optional query: `category`, `city`, `q`, `date`, `startTime`, `endTime` (see GetVenuesAllQueryDto).
 *   Canonical alias: **GET /public/venues/search** (same query + response).
 * - GET /getVenues/gaming|FutsalArenas — compact map-marker payloads.
 * - GET /getVenue/futsal|cricket|padel — same marker shape, filtered by sport facility counts.
 */
@Controller('getVenues')
export class GetVenuesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get()
  getVenues() {
    return this.businessesService.listVenueMarkersPublic('all');
  }

  @Get('all')
  getVenuesAll(@Query() query: GetVenuesAllQueryDto) {
    return this.businessesService.listVenueMarkersPublicWithFilters(query);
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
