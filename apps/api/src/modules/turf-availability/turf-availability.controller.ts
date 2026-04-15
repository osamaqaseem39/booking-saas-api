import { Body, Controller, Post } from '@nestjs/common';
import { TurfAvailabilityRequestDto } from './dto/turf-availability-request.dto';
import { TurfAvailabilityService } from './turf-availability.service';

@Controller('availability')
export class TurfAvailabilityController {
  constructor(
    private readonly turfAvailabilityService: TurfAvailabilityService,
  ) {}

  @Post('turf')
  byBranchAndDate(@Body() dto: TurfAvailabilityRequestDto) {
    return this.turfAvailabilityService.getAvailability(dto);
  }
}
