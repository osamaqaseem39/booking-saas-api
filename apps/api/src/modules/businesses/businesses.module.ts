import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PadelCourt } from '../arena/padel-court/entities/padel-court.entity';
import { BookingItem } from '../bookings/entities/booking-item.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { IamModule } from '../iam/iam.module';
import { BusinessesController } from './businesses.controller';
import { PublicDiscoveryController } from './public/public-discovery.controller';
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
      PadelCourt,
      Booking,
      BookingItem,
    ]),
  ],
  controllers: [
    BusinessesController,
    PublicDiscoveryController,
  ],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
