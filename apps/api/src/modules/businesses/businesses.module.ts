import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CricketIndoorCourt } from '../arena/cricket-indoor/entities/cricket-indoor-court.entity';
import { FutsalField } from '../arena/futsal-field/entities/futsal-field.entity';
import { PadelCourt } from '../arena/padel-court/entities/padel-court.entity';
import { TurfCourt } from '../arena/turf-court/entities/turf-court.entity';
import { BookingItem } from '../bookings/entities/booking-item.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { IamModule } from '../iam/iam.module';
import { BusinessesController } from './businesses.controller';
import { BusinessLocation } from './entities/business-location.entity';
import { BusinessMembership } from './entities/business-membership.entity';
import { Business } from './entities/business.entity';
import { BusinessesService } from './businesses.service';

@Module({
  imports: [
    IamModule,
    TypeOrmModule.forFeature([
      Business,
      BusinessMembership,
      BusinessLocation,
      TurfCourt,
      FutsalField,
      PadelCourt,
      CricketIndoorCourt,
      Booking,
      BookingItem,
    ]),
  ],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
