import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { GetVenuesAllQueryDto } from './dto/get-venues-all-query.dto';
import { BusinessesService } from './businesses.service';
import { ListLocationCitiesDto } from './dto/list-location-cities.dto';

/**
 * Canonical public discovery URLs. Legacy aliases remain on
 * getVenues, getVenue, getVenueDetails, getAllCities, getAllLocationTypes.
 *
 * `GET /public/venues` is the short map-marker list (same as
 * `GET /public/venues/markers` and legacy `GET /getVenues`). Full location rows
 * for dashboards that need them: `GET /businesses/locations` (no role gate on that handler).
 */
@Controller('public')
export class PublicDiscoveryController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get('cities')
  listCities(@Query() dto: ListLocationCitiesDto) {
    return this.businessesService.listLocationCitiesPublic(dto);
  }

  @Get('location-types')
  listLocationTypes() {
    return this.businessesService.listAllRegisteredLocationTypesPublic();
  }

  @Get('venues/markers/gaming')
  markersGaming() {
    return this.businessesService.listVenueMarkersPublic('gaming');
  }

  @Get('venues/markers/futsal')
  markersFutsal() {
    return this.businessesService.listVenueMarkersPublic('futsal');
  }

  @Get('venues/markers/cricket')
  markersCricket() {
    return this.businessesService.listVenueMarkersPublic('cricket');
  }

  @Get('venues/markers/padel')
  markersPadel() {
    return this.businessesService.listVenueMarkersPublic('padel');
  }

  @Get('venues/markers')
  markersAll() {
    return this.businessesService.listVenueMarkersPublic('all');
  }

  /**
   * Filtered venue discovery (canonical public path). Same response shape as
   * `GET /getVenues/all`: short map markers. Query: `category`, `city`, `q`, `date`, `startTime`, `endTime`.
   */
  @Get('venues/search')
  searchVenues(@Query() query: GetVenuesAllQueryDto) {
    return this.businessesService.listVenueMarkersPublicWithFilters(query);
  }

  @Get('venues/:venueId')
  venueProfile(@Param('venueId', ParseUUIDPipe) venueId: string) {
    return this.businessesService.getVenueDetailsPublic(venueId);
  }

  @Get('venues')
  listVenues() {
    return this.businessesService.listVenueMarkersPublic('all');
  }
}
