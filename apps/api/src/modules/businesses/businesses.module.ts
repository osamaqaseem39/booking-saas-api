import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PadelCourt } from '../arena/padel-court/entities/padel-court.entity';
import { BookingItem } from '../bookings/entities/booking-item.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { IamModule } from '../iam/iam.module';
import { BusinessesController } from './businesses.controller';
import { PublicDiscoveryController, PublicRootDiscoveryController } from './public/public-discovery.controller';
import { BusinessLocation } from './entities/business-location.entity';
import { BusinessMembership } from './entities/business-membership.entity';
import { Business } from './entities/business.entity';
import { BusinessesService } from './businesses.service';
import { SaasSubscriptionsModule } from '../saas-subscriptions/saas-subscriptions.module';

import { TurfCourt } from '../arena/turf/entities/turf-court.entity';
import { GamingStation } from '../arena/gaming-station/entities/gaming-station.entity';

@Module({
  imports: [
    IamModule,
    SaasSubscriptionsModule,
    TypeOrmModule.forFeature([
      Business,
      BusinessMembership,
      BusinessLocation,
      PadelCourt,
      TurfCourt,
      GamingStation,
      Booking,
      BookingItem,
    ]),
  ],
  controllers: [
    BusinessesController,
    PublicDiscoveryController,
    PublicRootDiscoveryController,
  ],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
