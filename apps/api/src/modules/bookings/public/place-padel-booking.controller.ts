import { Body, Controller, Logger, Post } from '@nestjs/common';
import { BookingsService } from '../bookings.service';
import { PlacePadelBookingDto } from '../dto/place-padel-booking.dto';
import { logBookingsCreateFailure } from '../utils/log-bookings-create-failure';

/**
 * Resolves tenant from venueId; no X-Tenant-Id required.
 * Server sets booking createdAt; pricing defaults to pending cash / zero until you extend the DTO.
 */
@Controller('placePadelBooking')
export class PlacePadelBookingController {
  private readonly logger = new Logger(PlacePadelBookingController.name);

  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async placePadelBooking(@Body() dto: PlacePadelBookingDto) {
    try {
      return await this.bookingsService.placePadelBooking(dto);
    } catch (err) {
      logBookingsCreateFailure(
        this.logger,
        'POST /placePadelBooking',
        err,
      );
      throw err;
    }
  }
}
