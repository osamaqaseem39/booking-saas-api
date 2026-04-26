import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../../businesses/businesses.module';
import { IamModule } from '../../iam/iam.module';
import { SaasSubscriptionsModule } from '../../saas-subscriptions/saas-subscriptions.module';
import { TenantTimeSlotTemplate } from '../../bookings/entities/tenant-time-slot-template.entity';
import { TenantTimeSlotTemplateLine } from '../../bookings/entities/tenant-time-slot-template-line.entity';
import { CourtFacilitySlot } from '../../bookings/entities/court-facility-slot.entity';
import { TurfCourt } from './entities/turf-court.entity';
import { TurfController } from './turf.controller';
import { TurfService } from './turf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TurfCourt,
      TenantTimeSlotTemplate,
      TenantTimeSlotTemplateLine,
      CourtFacilitySlot,
    ]),
    BusinessesModule,
    IamModule,
    SaasSubscriptionsModule,
  ],
  controllers: [TurfController],
  providers: [TurfService],
  exports: [TurfService, TypeOrmModule],
})
export class TurfModule {}
