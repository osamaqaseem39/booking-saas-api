import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PadelCourt } from '../arena/padel-court/entities/padel-court.entity';
import { TableTennisCourt } from '../arena/table-tennis-court/entities/table-tennis-court.entity';
import { TurfCourt } from '../arena/turf/entities/turf-court.entity';
import { User } from '../iam/entities/user.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { TenantTimeSlotTemplate } from './entities/tenant-time-slot-template.entity';
import { TenantTimeSlotTemplateLine } from './entities/tenant-time-slot-template-line.entity';
import { TimeSlotTemplatesService } from './time-slot-templates/time-slot-templates.service';
import { CourtFacilitySlot } from './entities/court-facility-slot.entity';
import { CourtSlotBookingBlock } from './entities/court-slot-booking-block.entity';
import { BookingItem } from './entities/booking-item.entity';
import { Booking } from './entities/booking.entity';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { Business } from '../businesses/entities/business.entity';
import { PlacePadelBookingController } from './public/place-padel-booking.controller';
import { PublicBookingsController } from './public/public-bookings.controller';
import { PreviousBookingsController } from './user/previous-bookings.controller';
import { IamModule } from '../iam/iam.module';

import { BookingsSlotsTask } from './tasks/bookings-slots.task';

@Module({
  imports: [
    IamModule,
    TypeOrmModule.forFeature([
      Booking,
      BookingItem,
      User,
      PadelCourt,
      TurfCourt,
      TableTennisCourt,
      BusinessLocation,
      Business,
      CourtSlotBookingBlock,
      CourtFacilitySlot,
      TenantTimeSlotTemplate,
      TenantTimeSlotTemplateLine,
    ]),
  ],
  controllers: [
    BookingsController,
    PlacePadelBookingController,
    PublicBookingsController,
    PreviousBookingsController,
  ],
  providers: [BookingsService, TimeSlotTemplatesService, BookingsSlotsTask],
  exports: [BookingsService, TimeSlotTemplatesService],
})
export class BookingsModule {}
