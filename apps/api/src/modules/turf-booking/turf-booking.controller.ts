import { Body, Controller, Post } from '@nestjs/common';
import { CreateTurfBookingDto } from './dto/create-turf-booking.dto';
import { TurfBookingService } from './turf-booking.service';

@Controller('turf-bookings')
export class TurfBookingController {
  constructor(private readonly turfBookingService: TurfBookingService) {}

  @Post()
  create(@Body() dto: CreateTurfBookingDto) {
    return this.turfBookingService.create(dto);
  }
}
