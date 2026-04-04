import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PadelCourt } from '../arena/padel-court/entities/padel-court.entity';
import { CricketCourt } from '../arena/cricket-court/entities/cricket-court.entity';
import { FutsalCourt } from '../arena/futsal-court/entities/futsal-court.entity';
import { BookingItem } from '../bookings/entities/booking-item.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { IamModule } from '../iam/iam.module';
import { BusinessesController } from './businesses.controller';
import { GetAllCitiesController } from './get-all-cities.controller';
import { GetAllLocationTypesController } from './get-all-location-types.controller';
import { GetVenueDetailsController } from './get-venue-details.controller';
import { GetVenueSportController } from './get-venue-sport.controller';
import { GetVenuesController } from './get-venues.controller';
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
      FutsalCourt,
      CricketCourt,
      PadelCourt,
      Booking,
      BookingItem,
    ]),
  ],
  controllers: [
    BusinessesController,
    GetAllCitiesController,
    GetAllLocationTypesController,
    GetVenuesController,
    GetVenueSportController,
    GetVenueDetailsController,
  ],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
