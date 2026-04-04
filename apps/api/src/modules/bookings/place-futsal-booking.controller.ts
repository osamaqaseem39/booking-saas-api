import { Body, Controller, Post } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { PlaceFutsalBookingDto } from './dto/place-futsal-booking.dto';

/**
 * Resolves tenant from venueId; no X-Tenant-Id required.
 * Server sets booking createdAt; pricing defaults to pending cash / zero until you extend the DTO.
 */
@Controller('placeFutsalBooking')
export class PlaceFutsalBookingController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  placeFutsalBooking(@Body() dto: PlaceFutsalBookingDto) {
    return this.bookingsService.placeFutsalBooking(dto);
  }
}
