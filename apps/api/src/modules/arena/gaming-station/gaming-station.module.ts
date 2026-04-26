import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../../businesses/businesses.module';
import { IamModule } from '../../iam/iam.module';
import { SaasSubscriptionsModule } from '../../saas-subscriptions/saas-subscriptions.module';
import {
  GamingStationController,
  TypedGamingStationController,
} from './gaming-station.controller';
import { GamingStationService } from './gaming-station.service';
import { GamingStation } from './entities/gaming-station.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([GamingStation]),
    IamModule,
    SaasSubscriptionsModule,
    BusinessesModule,
  ],
  controllers: [GamingStationController, TypedGamingStationController],
  providers: [GamingStationService],
  exports: [GamingStationService],
})
export class GamingStationModule {}
