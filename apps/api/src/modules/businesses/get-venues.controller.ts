import { Controller, Get, Query } from '@nestjs/common';
import { GetVenuesAllQueryDto } from './dto/get-venues-all-query.dto';
import { BusinessesService } from './businesses.service';

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

  @Get('padel')
  getVenuesPadel() {
    return this.businessesService.listVenueMarkersPublic('padel');
  }
}
