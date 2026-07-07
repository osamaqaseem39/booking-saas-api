import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsModule } from '../../bookings/bookings.module';
import { BusinessesModule } from '../../businesses/businesses.module';
import { IamModule } from '../../iam/iam.module';
import { SaasSubscriptionsModule } from '../../saas-subscriptions/saas-subscriptions.module';
import { TenantTimeSlotTemplate } from '../../bookings/entities/tenant-time-slot-template.entity';
import { TurfCourt } from './entities/turf-court.entity';
import { TurfController } from './turf.controller';
import { TurfService } from './turf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TurfCourt,
      TenantTimeSlotTemplate,
    ]),
    BookingsModule,
    BusinessesModule,
    IamModule,
    SaasSubscriptionsModule,
  ],
  controllers: [TurfController],
  providers: [TurfService],
  exports: [TurfService, TypeOrmModule],
})
export class TurfModule {}
