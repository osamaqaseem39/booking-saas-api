import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { COURT_KINDS, type CourtKind } from './booking.types';
import { BookingAvailabilityQueryDto } from './dto/booking-availability-query.dto';
import { CourtSlotsQueryDto } from './dto/court-slots-query.dto';
import { CurrentTenant } from '../../tenancy/tenant-context.decorator';
import { TenantContext } from '../../tenancy/tenant-context.interface';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  list(@CurrentTenant() tenant: TenantContext) {
    return this.bookingsService.list(tenant.tenantId);
  }

  @Get('availability')
  availabilityByTime(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: BookingAvailabilityQueryDto,
  ) {
    return this.bookingsService.getAvailabilityByTime(tenant.tenantId, query);
  }

  @Get('courts/:courtKind/:courtId/slots')
  courtSlots(
    @CurrentTenant() tenant: TenantContext,
    @Param('courtKind') courtKind: string,
    @Param('courtId', ParseUUIDPipe) courtId: string,
    @Query() query: CourtSlotsQueryDto,
  ) {
    if (!COURT_KINDS.includes(courtKind as CourtKind)) {
      throw new BadRequestException(
        `courtKind must be one of: ${COURT_KINDS.join(', ')}`,
      );
    }
    return this.bookingsService.getCourtSlots(tenant.tenantId, {
      kind: courtKind as CourtKind,
      courtId,
      date: query.date,
    });
  }

  @Get(':bookingId')
  getOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.bookingsService.getOne(tenant.tenantId, bookingId);
  }

  @Post()
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.create(tenant.tenantId, dto);
  }

  @Patch(':bookingId')
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.bookingsService.update(tenant.tenantId, bookingId, dto);
  }
}
