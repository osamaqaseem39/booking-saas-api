import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { BookingsService } from '../bookings.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { PlacePadelBookingDto } from '../dto/place-padel-booking.dto';

@Controller('public/bookings')
export class PublicBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('padel')
  async placePadelBooking(@Body() dto: any) {
    // If it looks like a full booking payload, use create()
    if (dto.items && Array.isArray(dto.items)) {
      return this.createPublicBooking(dto);
    }
    // Otherwise use legacy simple placePadelBooking
    return this.bookingsService.placePadelBooking(dto as PlacePadelBookingDto);
  }

  @Post(['futsal', 'cricket', 'turf'])
  async placeTurfBooking(@Body() dto: CreateBookingDto) {
    return this.createPublicBooking(dto);
  }

  private async createPublicBooking(dto: CreateBookingDto) {
    const firstItem = dto.items?.[0];
    if (!firstItem) {
      throw new BadRequestException('At least one booking item is required');
    }
    const tenantId = await this.bookingsService.resolveTenantIdByCourt(
      firstItem.courtKind,
      firstItem.courtId,
    );
    if (!tenantId) {
      throw new BadRequestException('Unable to resolve tenant for the selected court');
    }
    return this.bookingsService.create(tenantId, dto);
  }
}
