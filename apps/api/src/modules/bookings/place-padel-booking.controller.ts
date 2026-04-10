import { Body, Controller, Post } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { PlacePadelBookingDto } from './dto/place-padel-booking.dto';

/**
 * Resolves tenant from venueId; no X-Tenant-Id required.
 * Server sets booking createdAt; pricing defaults to pending cash / zero until you extend the DTO.
 */
@Controller('placePadelBooking')
export class PlacePadelBookingController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  placePadelBooking(@Body() dto: PlacePadelBookingDto) {
    return this.bookingsService.placePadelBooking(dto);
  }
}
