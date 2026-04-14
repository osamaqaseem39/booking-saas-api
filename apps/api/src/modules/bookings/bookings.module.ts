import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PadelCourt } from '../arena/padel-court/entities/padel-court.entity';
import { CricketCourt } from '../arena/cricket-court/entities/cricket-court.entity';
import { FutsalCourt } from '../arena/futsal-court/entities/futsal-court.entity';
import { User } from '../iam/entities/user.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { TenantTimeSlotTemplate } from './entities/tenant-time-slot-template.entity';
import { TenantTimeSlotTemplateLine } from './entities/tenant-time-slot-template-line.entity';
import { TimeSlotTemplatesService } from './time-slot-templates.service';
import { CourtFacilitySlot } from './entities/court-facility-slot.entity';
import { CourtSlotBookingBlock } from './entities/court-slot-booking-block.entity';
import { BookingItem } from './entities/booking-item.entity';
import { Booking } from './entities/booking.entity';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { Business } from '../businesses/entities/business.entity';
import { PlaceCricketBookingController } from './place-cricket-booking.controller';
import { PlaceFutsalBookingController } from './place-futsal-booking.controller';
import { PlacePadelBookingController } from './place-padel-booking.controller';
import { PublicCricketBookingController } from './public-cricket-booking.controller';
import { PublicFutsalBookingController } from './public-futsal-booking.controller';
import { PublicPadelBookingController } from './public-padel-booking.controller';
import { PreviousBookingsController } from './previous-bookings.controller';
import { IamModule } from '../iam/iam.module';

@Module({
  imports: [
    IamModule,
    TypeOrmModule.forFeature([
      Booking,
      BookingItem,
      User,
      FutsalCourt,
      CricketCourt,
      PadelCourt,
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
    PlaceCricketBookingController,
    PlaceFutsalBookingController,
    PlacePadelBookingController,
    PublicCricketBookingController,
    PublicFutsalBookingController,
    PublicPadelBookingController,
    PreviousBookingsController,
  ],
  providers: [BookingsService, TimeSlotTemplatesService],
  exports: [TimeSlotTemplatesService],
})
export class BookingsModule {}
