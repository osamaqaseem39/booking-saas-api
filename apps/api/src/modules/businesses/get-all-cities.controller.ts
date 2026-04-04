import { Controller, Get, Query } from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { ListLocationCitiesDto } from './dto/list-location-cities.dto';

/** Alias: distinct cities for filters and sidebar (same as GET /businesses/locations/cities). */
@Controller('getAllCities')
export class GetAllCitiesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get()
  getAllCities(@Query() dto: ListLocationCitiesDto) {
    return this.businessesService.listLocationCitiesPublic(dto);
  }
}
