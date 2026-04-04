import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CricketIndoorCourt } from '../arena/cricket-indoor/entities/cricket-indoor-court.entity';
import { FutsalField } from '../arena/futsal-field/entities/futsal-field.entity';
import { PadelCourt } from '../arena/padel-court/entities/padel-court.entity';
import { TurfCourt } from '../arena/turf-court/entities/turf-court.entity';
import { User } from '../iam/entities/user.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { CourtSlotBookingBlock } from './entities/court-slot-booking-block.entity';
import { BookingItem } from './entities/booking-item.entity';
import { Booking } from './entities/booking.entity';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { Business } from '../businesses/entities/business.entity';
import { PlaceFutsalBookingController } from './place-futsal-booking.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      BookingItem,
      User,
      TurfCourt,
      FutsalField,
      PadelCourt,
      CricketIndoorCourt,
      BusinessLocation,
      Business,
      CourtSlotBookingBlock,
    ]),
  ],
  controllers: [BookingsController, PlaceFutsalBookingController],
  providers: [BookingsService],
})
export class BookingsModule {}
