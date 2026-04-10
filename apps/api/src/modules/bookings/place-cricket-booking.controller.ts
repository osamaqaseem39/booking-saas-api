import { Body, Controller, Post } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { PlaceCricketBookingDto } from './dto/place-cricket-booking.dto';

/**
 * Resolves tenant from venueId; no X-Tenant-Id required.
 * Server sets booking createdAt; pricing defaults to pending cash / zero until you extend the DTO.
 */
@Controller('placeCricketBooking')
export class PlaceCricketBookingController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  placeCricketBooking(@Body() dto: PlaceCricketBookingDto) {
    return this.bookingsService.placeCricketBooking(dto);
  }
}
