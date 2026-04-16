import { Body, Controller, Post } from '@nestjs/common';
import { BookingsService } from '../bookings.service';
import { PlacePadelBookingDto } from '../dto/place-padel-booking.dto';

/** Canonical path for the same handler as POST /placePadelBooking. */
@Controller('public/bookings')
export class PublicPadelBookingController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('padel')
  placePadelBooking(@Body() dto: PlacePadelBookingDto) {
    return this.bookingsService.placePadelBooking(dto);
  }
}
