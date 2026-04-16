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

  @Get(['venues/markers/padel', '/getVenues/padel'])
  markersPadel() {
    return this.businessesService.listVenueMarkersPublic('padel');
  }

  @Get(['venues/markers', '/getVenues'])
  markersAll() {
    return this.businessesService.listVenueMarkersPublic('all');
  }

  @Get(['venues/search', '/getVenues/all'])
  searchVenues(@Query() query: GetVenuesAllQueryDto) {
    return this.businessesService.listVenueMarkersPublicWithFilters(query);
  }

  @Get(['venues/:venueId', '/getVenueDetails/:venueId'])
  venueProfile(@Param('venueId', ParseUUIDPipe) venueId: string) {
    return this.businessesService.getVenueDetailsPublic(venueId);
  }

  @Get('venues')
  listVenues() {
    return this.businessesService.listVenueMarkersPublic('all');
  }
}
