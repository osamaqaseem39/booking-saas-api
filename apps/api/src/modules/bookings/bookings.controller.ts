import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import {
  COURT_KINDS,
  COURT_SLOT_GRID_STEP_MINUTES,
  type CourtKind,
} from './booking.types';
import { BookingAvailabilityQueryDto } from './dto/booking-availability-query.dto';
import { CourtSlotGridQueryDto } from './dto/court-slot-grid-query.dto';
import { CourtSlotsQueryDto } from './dto/court-slots-query.dto';
import { LocationFacilitySlotsQueryDto } from './dto/location-facility-slots-query.dto';
import { CurrentTenant } from '../../tenancy/tenant-context.decorator';
import { TenantContext } from '../../tenancy/tenant-context.interface';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { GenerateFacilitySlotsDto } from './dto/generate-facility-slots.dto';
import { PatchFacilitySlotDto } from './dto/patch-facility-slot.dto';
import { SetCourtSlotBlockDto } from './dto/set-court-slot-block.dto';
import { EditBookingFacilitySlotsDto } from './dto/edit-booking-facility-slots.dto';
import { CreateTimeSlotTemplateDto } from './dto/create-time-slot-template.dto';
import { UpdateTimeSlotTemplateDto } from './dto/update-time-slot-template.dto';
import { Roles } from '../iam/authz/roles.decorator';
import { RolesGuard } from '../iam/authz/roles.guard';
import { TimeSlotTemplatesService } from './time-slot-templates.service';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly timeSlotTemplatesService: TimeSlotTemplatesService,
  ) {}

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
    return this.bookingsService.getAvailabilityByTime(tenantId, query);
  }

  @Get('time-slot-templates')
  listTimeSlotTemplates(@CurrentTenant() tenant: TenantContext) {
    const tenantId = this.getTenantUuidOrNull(tenant);
    if (!tenantId) return [];
    return this.timeSlotTemplatesService.list(tenantId);
  }

  @Post('time-slot-templates')
  @UseGuards(RolesGuard)
  @Roles('platform-owner', 'business-admin')
  createTimeSlotTemplate(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateTimeSlotTemplateDto,
  ) {
    return this.timeSlotTemplatesService.create(
      this.requireTenantUuid(tenant),
      dto,
    );
  }

  @Patch('time-slot-templates/:templateId')
  @UseGuards(RolesGuard)
  @Roles('platform-owner', 'business-admin')
  updateTimeSlotTemplate(
    @CurrentTenant() tenant: TenantContext,
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() dto: UpdateTimeSlotTemplateDto,
  ) {
    return this.timeSlotTemplatesService.update(
      this.requireTenantUuid(tenant),
      templateId,
      dto,
    );
  }

  @Delete('time-slot-templates/:templateId')
  @UseGuards(RolesGuard)
  @Roles('platform-owner', 'business-admin')
  deleteTimeSlotTemplate(
    @CurrentTenant() tenant: TenantContext,
    @Param('templateId', ParseUUIDPipe) templateId: string,
  ) {
    return this.timeSlotTemplatesService.remove(
      this.requireTenantUuid(tenant),
      templateId,
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
      startTime: query.startTime,
      endTime: query.endTime,
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
        segmentMinutes: COURT_SLOT_GRID_STEP_MINUTES,
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

  @Get('locations/:locationId/facilities/available-slots')
  locationFacilitiesAvailableSlots(
    @CurrentTenant() tenant: TenantContext,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Query() query: LocationFacilitySlotsQueryDto,
  ) {
    const tenantId = this.getTenantUuidOrNull(tenant);
    if (!tenantId) {
      return {
        date: query.date,
        locationId,
        facilities: [],
      };
    }
    return this.bookingsService.getLocationFacilitiesAvailableSlots(tenantId, {
      locationId,
      date: query.date,
      startTime: query.startTime,
      endTime: query.endTime,
    });
  }

  @Put('courts/:courtKind/:courtId/slot-blocks')
  setCourtSlotBlock(
    @CurrentTenant() tenant: TenantContext,
    @Param('courtKind') courtKind: string,
    @Param('courtId', ParseUUIDPipe) courtId: string,
    @Body() dto: SetCourtSlotBlockDto,
  ) {
    if (!COURT_KINDS.includes(courtKind as CourtKind)) {
      throw new BadRequestException(
        `courtKind must be one of: ${COURT_KINDS.join(', ')}`,
      );
    }
    return this.bookingsService.setCourtSlotBlock(
      this.requireTenantUuid(tenant),
      {
        kind: courtKind as CourtKind,
        courtId,
        date: dto.date,
        startTime: dto.startTime,
        blocked: dto.blocked,
      },
    );
  }

  @Post('courts/:courtKind/:courtId/facility-slots/generate')
  generateFacilityDaySlots(
    @CurrentTenant() tenant: TenantContext,
    @Param('courtKind') courtKind: string,
    @Param('courtId', ParseUUIDPipe) courtId: string,
    @Body() dto: GenerateFacilitySlotsDto,
  ) {
    if (!COURT_KINDS.includes(courtKind as CourtKind)) {
      throw new BadRequestException(
        `courtKind must be one of: ${COURT_KINDS.join(', ')}`,
      );
    }
    return this.bookingsService.generateDayFacilitySlots(
      this.requireTenantUuid(tenant),
      {
        kind: courtKind as CourtKind,
        courtId,
        date: dto.date,
      },
    );
  }

  @Patch('courts/:courtKind/:courtId/facility-slots')
  patchFacilitySlot(
    @CurrentTenant() tenant: TenantContext,
    @Param('courtKind') courtKind: string,
    @Param('courtId', ParseUUIDPipe) courtId: string,
    @Body() dto: PatchFacilitySlotDto,
  ) {
    if (!COURT_KINDS.includes(courtKind as CourtKind)) {
      throw new BadRequestException(
        `courtKind must be one of: ${COURT_KINDS.join(', ')}`,
      );
    }
    return this.bookingsService.patchFacilitySlot(
      this.requireTenantUuid(tenant),
      {
        kind: courtKind as CourtKind,
        courtId,
        date: dto.date,
        startTime: dto.startTime,
        status: dto.status,
      },
    );
  }

  @Get(':bookingId')
  getOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.bookingsService.getOne(
      this.requireTenantUuid(tenant),
      bookingId,
    );
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

  @Patch(':bookingId/facility-slots')
  editBookingFacilitySlots(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: EditBookingFacilitySlotsDto,
  ) {
    return this.bookingsService.editBookingFacilitySlots(
      this.requireTenantUuid(tenant),
      bookingId,
      dto.blocked,
    );
  }
}
