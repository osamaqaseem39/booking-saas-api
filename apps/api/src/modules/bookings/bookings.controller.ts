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
import { LocationFacilitySlotPickQueryDto } from './dto/location-facility-slot-pick-query.dto';
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

  private async resolveTenantForCourt(
    tenant: TenantContext,
    courtKind: CourtKind,
    courtId: string,
  ): Promise<string | null> {
    const tenantId = this.getTenantUuidOrNull(tenant);
    if (tenantId) return tenantId;
    return this.bookingsService.resolveTenantIdByCourt(courtKind, courtId);
  }

  private async resolveTenantForBooking(
    tenant: TenantContext,
    bookingId: string,
  ): Promise<string | null> {
    const tenantId = this.getTenantUuidOrNull(tenant);
    if (tenantId) return tenantId;
    return this.bookingsService.resolveTenantIdByBooking(bookingId);
  }

  private async resolveTenantForTemplate(
    tenant: TenantContext,
    templateId: string,
  ): Promise<string | null> {
    const tenantId = this.getTenantUuidOrNull(tenant);
    if (tenantId) return tenantId;
    return this.bookingsService.resolveTenantIdByTimeSlotTemplate(templateId);
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
  async createTimeSlotTemplate(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateTimeSlotTemplateDto,
  ) {
    const tenantId = this.getTenantUuidOrNull(tenant);
    if (!tenantId) {
      throw new BadRequestException(
        'X-Tenant-Id is optional for reads but required to create a template.',
      );
    }
    return this.timeSlotTemplatesService.create(tenantId, dto);
  }

  @Patch('time-slot-templates/:templateId')
  @UseGuards(RolesGuard)
  @Roles('platform-owner', 'business-admin')
  async updateTimeSlotTemplate(
    @CurrentTenant() tenant: TenantContext,
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() dto: UpdateTimeSlotTemplateDto,
  ) {
    const tenantId = await this.resolveTenantForTemplate(tenant, templateId);
    if (!tenantId) {
      throw new BadRequestException('Unable to resolve tenant for template.');
    }
    return this.timeSlotTemplatesService.update(tenantId, templateId, dto);
  }

  @Delete('time-slot-templates/:templateId')
  @UseGuards(RolesGuard)
  @Roles('platform-owner', 'business-admin')
  async deleteTimeSlotTemplate(
    @CurrentTenant() tenant: TenantContext,
    @Param('templateId', ParseUUIDPipe) templateId: string,
  ) {
    const tenantId = await this.resolveTenantForTemplate(tenant, templateId);
    if (!tenantId) {
      throw new BadRequestException('Unable to resolve tenant for template.');
    }
    return this.timeSlotTemplatesService.remove(tenantId, templateId);
  }

  @Get('courts/:courtKind/:courtId/slots')
  async courtSlots(
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
    const tenantId = await this.resolveTenantForCourt(
      tenant,
      courtKind as CourtKind,
      courtId,
    );
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
  async courtSlotGrid(
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
    const tenantId = await this.resolveTenantForCourt(
      tenant,
      courtKind as CourtKind,
      courtId,
    );
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
      availableOnly: query.availableOnly === 'true',
    });
  }

  @Get('locations/:locationId/facilities/available-slots')
  async locationFacilitiesAvailableSlots(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Query() query: LocationFacilitySlotsQueryDto,
  ) {
    return this.bookingsService.getLocationFacilitiesAvailableSlots({
      locationId,
      date: query.date,
      startTime: query.startTime,
      endTime: query.endTime,
      courtType: query.courtType,
    });
  }

  @Get('locations/:locationId/facilities/available-for-slot')
  async locationFacilitiesAvailableForSlot(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Query() query: LocationFacilitySlotPickQueryDto,
  ) {
    return this.bookingsService.getLocationFacilitiesAvailableForSlot({
      locationId,
      date: query.date,
      startTime: query.startTime,
      endTime: query.endTime,
    });
  }

  @Put('courts/:courtKind/:courtId/slot-blocks')
  async setCourtSlotBlock(
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
    const tenantId = await this.resolveTenantForCourt(
      tenant,
      courtKind as CourtKind,
      courtId,
    );
    if (!tenantId) {
      throw new BadRequestException('Unable to resolve tenant for court.');
    }
    return this.bookingsService.setCourtSlotBlock(tenantId, {
      kind: courtKind as CourtKind,
      courtId,
      date: dto.date,
      startTime: dto.startTime,
      blocked: dto.blocked,
    });
  }

  @Post('courts/:courtKind/:courtId/facility-slots/generate')
  async generateFacilityDaySlots(
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
    const tenantId = await this.resolveTenantForCourt(
      tenant,
      courtKind as CourtKind,
      courtId,
    );
    if (!tenantId) {
      throw new BadRequestException('Unable to resolve tenant for court.');
    }
    return this.bookingsService.generateDayFacilitySlots(tenantId, {
      kind: courtKind as CourtKind,
      courtId,
      date: dto.date,
    });
  }

  @Patch('courts/:courtKind/:courtId/facility-slots')
  async patchFacilitySlot(
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
    const tenantId = await this.resolveTenantForCourt(
      tenant,
      courtKind as CourtKind,
      courtId,
    );
    if (!tenantId) {
      throw new BadRequestException('Unable to resolve tenant for court.');
    }
    return this.bookingsService.patchFacilitySlot(tenantId, {
      kind: courtKind as CourtKind,
      courtId,
      date: dto.date,
      startTime: dto.startTime,
      status: dto.status,
    });
  }

  @Get(':bookingId')
  async getOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    const tenantId = await this.resolveTenantForBooking(tenant, bookingId);
    if (!tenantId) {
      throw new BadRequestException('Unable to resolve tenant for booking.');
    }
    return this.bookingsService.getOne(tenantId, bookingId);
  }

  @Post()
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateBookingDto,
  ) {
    const tenantIdFromHeader = this.getTenantUuidOrNull(tenant);
    const firstItem = dto.items?.[0];
    const resolvedFromCourt = firstItem
      ? await this.bookingsService.resolveTenantIdByCourt(
          firstItem.courtKind,
          firstItem.courtId,
        )
      : null;
    const tenantId = tenantIdFromHeader ?? resolvedFromCourt;
    if (!tenantId) {
      throw new BadRequestException(
        'Unable to resolve tenant. Provide a valid court in items or X-Tenant-Id.',
      );
    }
    return this.bookingsService.create(tenantId, dto);
  }

  @Patch(':bookingId')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: UpdateBookingDto,
  ) {
    const tenantId = await this.resolveTenantForBooking(tenant, bookingId);
    if (!tenantId) {
      throw new BadRequestException('Unable to resolve tenant for booking.');
    }
    return this.bookingsService.update(tenantId, bookingId, dto);
  }

  @Patch(':bookingId/facility-slots')
  async editBookingFacilitySlots(
    @CurrentTenant() tenant: TenantContext,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: EditBookingFacilitySlotsDto,
  ) {
    const tenantId = await this.resolveTenantForBooking(tenant, bookingId);
    if (!tenantId) {
      throw new BadRequestException('Unable to resolve tenant for booking.');
    }
    return this.bookingsService.editBookingFacilitySlots(
      tenantId,
      bookingId,
      dto.blocked,
    );
  }
}
