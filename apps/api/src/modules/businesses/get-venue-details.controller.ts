import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { BusinessesService } from './businesses.service';

@Controller('getVenueDetails')
export class GetVenueDetailsController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get(':locationId')
  getVenueDetails(@Param('locationId', ParseUUIDPipe) locationId: string) {
    return this.businessesService.getVenueDetailsPublic(locationId);
  }
}
