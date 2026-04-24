import {
  Body,
  Controller,
  HttpException,
  InternalServerErrorException,
  Logger,
  Post,
} from '@nestjs/common';
import { BookingsService } from '../bookings.service';
import { PlacePadelBookingDto } from '../dto/place-padel-booking.dto';

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
    } catch (e) {
      if (e instanceof HttpException) throw e;
      this.logger.error('placePadelBooking failed', e);
      throw new InternalServerErrorException('Failed to create booking');
    }
  }
}
