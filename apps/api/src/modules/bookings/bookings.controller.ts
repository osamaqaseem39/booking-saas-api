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
import { isUUID } from 'class-validator';
import { COURT_KINDS, type CourtKind } from './booking.types';
import { BookingAvailabilityQueryDto } from './dto/booking-availability-query.dto';
import { CourtSlotGridQueryDto } from './dto/court-slot-grid-query.dto';
import { CourtSlotsQueryDto } from './dto/court-slots-query.dto';
import { CurrentTenant } from '../../tenancy/tenant-context.decorator';
import { TenantContext } from '../../tenancy/tenant-context.interface';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  private getTenantUuidOrNull(tenant: TenantContext): string | null {
    const tenantId = tenant?.tenantId?.trim() ?? '';
    return isUUID(tenantId, 4) ? tenantId : null;
  }

  private requireTenantUuid(tenant: TenantContext): string {
    const tenantId = this.getTenantUuidOrNull(tenant);
    if (!tenantId) {
      throw new BadRequestException(
        'Valid X-Tenant-Id UUID is required for bookings endpoints',
      );
    }
    return tenantId;
  }

  @Get()
  list(@CurrentTenant() tenant: TenantContext) {
    return this.bookingsService.list(this.requireTenantUuid(tenant));
  }

  @Get('availability')
  availabilityByTime(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: BookingAvailabilityQueryDto,
  ) {
    const tenantId = this.getTenantUuidOrNull(tenant);
    if (!tenantId) {
      return {
        date: query.date,
        startTime: query.startTime,
        endTime: query.endTime,
        sportType: query.sportType,
        availableCourts: [],
        bookedSlots: [],
      };
    }
    return this.bookingsService.getAvailabilityByTime(
      tenantId,
      query,
    );
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
    const tenantId = this.getTenantUuidOrNull(tenant);
    if (!tenantId) {
      return {
        date: query.date,
        kind: courtKind as CourtKind,
        courtId,
        slots: [],
      };
    }
    return this.bookingsService.getCourtSlots(tenantId, {
      kind: courtKind as CourtKind,
      courtId,
      date: query.date,
    });
  }

  @Get('courts/:courtKind/:courtId/slot-grid')
  courtSlotGrid(
    @CurrentTenant() tenant: TenantContext,
    @Param('courtKind') courtKind: string,
    @Param('courtId', ParseUUIDPipe) courtId: string,
    @Query() query: CourtSlotGridQueryDto,
  ) {
    if (!COURT_KINDS.includes(courtKind as CourtKind)) {
      throw new BadRequestException(
        `courtKind must be one of: ${COURT_KINDS.join(', ')}`,
      );
    }
    const tenantId = this.getTenantUuidOrNull(tenant);
    if (!tenantId) {
      return {
        date: query.date,
        kind: courtKind as CourtKind,
        courtId,
        segmentMinutes: 30 as const,
        gridStartTime: query.startTime ?? '00:00',
        gridEndTime: query.endTime ?? '24:00',
        segments: [],
      };
    }
    return this.bookingsService.getCourtSlotGrid(tenantId, {
      kind: courtKind as CourtKind,
      courtId,
      date: query.date,
      startTime: query.startTime,
      endTime: query.endTime,
      useWorkingHours: query.useWorkingHours === 'true',
      availableOnly: query.availableOnly === 'true',
    });
  }

  @Get(':bookingId')
  getOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.bookingsService.getOne(this.requireTenantUuid(tenant), bookingId);
  }

  @Post()
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.create(this.requireTenantUuid(tenant), dto);
  }

  @Patch(':bookingId')
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.bookingsService.update(
      this.requireTenantUuid(tenant),
      bookingId,
      dto,
    );
  }
}
