import { Body, Controller, Post } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { PlaceFutsalBookingDto } from './dto/place-futsal-booking.dto';

/** Canonical path for the same handler as POST /placeFutsalBooking. */
@Controller('public/bookings')
export class PublicFutsalBookingController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('futsal')
  placeFutsalBooking(@Body() dto: PlaceFutsalBookingDto) {
    return this.bookingsService.placeFutsalBooking(dto);
  }
}
