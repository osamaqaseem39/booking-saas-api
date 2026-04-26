import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsModule } from '../../bookings/bookings.module';
import { BusinessesModule } from '../../businesses/businesses.module';
import { IamModule } from '../../iam/iam.module';
import { SaasSubscriptionsModule } from '../../saas-subscriptions/saas-subscriptions.module';
import { TenantTimeSlotTemplate } from '../../bookings/entities/tenant-time-slot-template.entity';
import { TenantTimeSlotTemplateLine } from '../../bookings/entities/tenant-time-slot-template-line.entity';
import { CourtFacilitySlot } from '../../bookings/entities/court-facility-slot.entity';
import { TableTennisCourt } from './entities/table-tennis-court.entity';
import { TableTennisCourtController } from './table-tennis-court.controller';
import { TableTennisCourtService } from './table-tennis-court.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TableTennisCourt,
      TenantTimeSlotTemplate,
      TenantTimeSlotTemplateLine,
      CourtFacilitySlot,
    ]),
    IamModule,
    SaasSubscriptionsModule,
    BusinessesModule,
    BookingsModule,
  ],
  controllers: [TableTennisCourtController],
  providers: [TableTennisCourtService],
  exports: [TableTennisCourtService],
})
export class TableTennisCourtModule {}
