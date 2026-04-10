import { Body, Controller, Post } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { PlaceCricketBookingDto } from './dto/place-cricket-booking.dto';

/** Canonical path for the same handler as POST /placeCricketBooking. */
@Controller('public/bookings')
export class PublicCricketBookingController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('cricket')
  placeCricketBooking(@Body() dto: PlaceCricketBookingDto) {
    return this.bookingsService.placeCricketBooking(dto);
  }
}
