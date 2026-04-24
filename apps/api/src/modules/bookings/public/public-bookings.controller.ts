import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  InternalServerErrorException,
  Logger,
  Post,
} from '@nestjs/common';
import { BookingsService } from '../bookings.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { PlacePadelBookingDto } from '../dto/place-padel-booking.dto';

@Controller('public/bookings')
export class PublicBookingsController {
  private readonly logger = new Logger(PublicBookingsController.name);

  constructor(private readonly bookingsService: BookingsService) {}

  @Post('padel')
  async placePadelBooking(@Body() dto: any) {
    try {
      // If it looks like a full booking payload, use create()
      if (dto.items && Array.isArray(dto.items)) {
        return await this.createPublicBooking(dto);
      }
      // Otherwise use legacy simple placePadelBooking
      return await this.bookingsService.placePadelBooking(dto as PlacePadelBookingDto);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      this.logger.error('public padel booking failed', e);
      throw new InternalServerErrorException('Failed to create booking');
    }
  }

  @Post(['futsal', 'cricket', 'turf'])
  async placeTurfBooking(@Body() dto: CreateBookingDto) {
    try {
      return await this.createPublicBooking(dto);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      this.logger.error('public booking create failed', e);
      throw new InternalServerErrorException('Failed to create booking');
    }
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
