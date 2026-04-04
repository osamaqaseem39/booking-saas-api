import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PadelCourt } from '../arena/padel-court/entities/padel-court.entity';
import { CricketCourt } from '../arena/cricket-court/entities/cricket-court.entity';
import { FutsalCourt } from '../arena/futsal-court/entities/futsal-court.entity';
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
      FutsalCourt,
      CricketCourt,
      PadelCourt,
      BusinessLocation,
      Business,
      CourtSlotBookingBlock,
    ]),
  ],
  controllers: [BookingsController, PlaceFutsalBookingController],
  providers: [BookingsService],
})
export class BookingsModule {}
