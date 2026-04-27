import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { GetVenuesAllQueryDto } from '../dto/get-venues-all-query.dto';
import { BusinessesService } from '../businesses.service';
import { ListLocationCitiesDto } from '../dto/list-location-cities.dto';

@Controller('public')
export class PublicDiscoveryController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get(['cities', '/getAllCities'])
  listCities(@Query() dto: ListLocationCitiesDto) {
    return this.businessesService.listLocationCitiesPublic(dto);
  }

  @Get(['location-types', '/getAllLocationTypes'])
  listLocationTypes() {
    return this.businessesService.listAllRegisteredLocationTypesPublic();
  }

  @Get(['venues/markers/gaming', '/getVenues/gaming'])
  markersGaming() {
    return this.businessesService.listVenueMarkersPublic('gaming');
  }

  @Get(['venues/markers/padel', '/getVenues/padel', '/getVenue/padel'])
  markersPadel() {
    return this.businessesService.listVenueMarkersPublic('padel');
  }

  @Get(['venues/markers/futsal', '/getVenues/futsal', '/getVenue/futsal'])
  markersFutsal() {
    return this.businessesService.listVenueMarkersPublic('futsal');
  }

  @Get(['venues/markers/cricket', '/getVenues/cricket', '/getVenue/cricket'])
  markersCricket() {
    return this.businessesService.listVenueMarkersPublic('cricket');
  }

  @Get([
    'venues/markers/table-tennis',
    '/getVenues/table-tennis',
    '/getVenue/table-tennis',
  ])
  markersTableTennis() {
    return this.businessesService.listVenueMarkersPublic('table-tennis');
  }

  @Get(['venues/markers', '/getVenues'])
  markersAll() {
    return this.businessesService.listVenueMarkersPublic('all');
  }

  @Get(['venues/search', '/getVenues/all'])
  searchVenues(@Query() query: GetVenuesAllQueryDto) {
    return this.businessesService.listVenueMarkersPublicWithFilters(query);
  }

  @Get(['venues/:venueId', '/getVenueDetails/:venueId', '/getVenue/:venueId'])
  venueProfile(@Param('venueId', ParseUUIDPipe) venueId: string) {
    return this.businessesService.getVenueDetailsPublic(venueId);
  }

  @Get('venues')
  listVenues() {
    return this.businessesService.listVenueMarkersPublic('all');
  }
}

/** Legacy root-level aliases for public discovery. */
@Controller()
export class PublicRootDiscoveryController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get(['getAllCities'])
  listCities(@Query() dto: ListLocationCitiesDto) {
    return this.businessesService.listLocationCitiesPublic(dto);
  }

  @Get(['getAllLocationTypes'])
  listLocationTypes() {
    return this.businessesService.listAllRegisteredLocationTypesPublic();
  }

  @Get(['getVenues/gaming'])
  markersGaming() {
    return this.businessesService.listVenueMarkersPublic('gaming');
  }

  @Get(['getVenues/padel', 'getVenue/padel'])
  markersPadel() {
    return this.businessesService.listVenueMarkersPublic('padel');
  }

  @Get(['getVenues/futsal', 'getVenue/futsal'])
  markersFutsal() {
    return this.businessesService.listVenueMarkersPublic('futsal');
  }

  @Get(['getVenues/cricket', 'getVenue/cricket'])
  markersCricket() {
    return this.businessesService.listVenueMarkersPublic('cricket');
  }

  @Get(['getVenues/table-tennis', 'getVenue/table-tennis'])
  markersTableTennis() {
    return this.businessesService.listVenueMarkersPublic('table-tennis');
  }

  @Get(['getVenues/turf'])
  markersTurf() {
    return this.businessesService.listVenueMarkersPublic('turf');
  }

  @Get(['getVenues'])
  markersAll() {
    return this.businessesService.listVenueMarkersPublic('all');
  }

  @Get(['getVenues/all'])
  searchVenues(@Query() query: GetVenuesAllQueryDto) {
    return this.businessesService.listVenueMarkersPublicWithFilters(query);
  }

  @Get(['getVenueDetails/:venueId', 'getVenue/:venueId'])
  venueProfile(@Param('venueId', ParseUUIDPipe) venueId: string) {
    return this.businessesService.getVenueDetailsPublic(venueId);
  }
}
