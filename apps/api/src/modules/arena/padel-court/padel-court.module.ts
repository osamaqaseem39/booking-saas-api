import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsModule } from '../../bookings/bookings.module';
import { BusinessesModule } from '../../businesses/businesses.module';
import { IamModule } from '../../iam/iam.module';
import { TenantTimeSlotTemplate } from '../../bookings/entities/tenant-time-slot-template.entity';
import { TenantTimeSlotTemplateLine } from '../../bookings/entities/tenant-time-slot-template-line.entity';
import { CourtFacilitySlot } from '../../bookings/entities/court-facility-slot.entity';
import { PadelCourt } from './entities/padel-court.entity';
import { PadelCourtController } from './padel-court.controller';
import { PadelCourtService } from './padel-court.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PadelCourt,
      TenantTimeSlotTemplate,
      TenantTimeSlotTemplateLine,
      CourtFacilitySlot,
    ]),
    IamModule,
    BusinessesModule,
    BookingsModule,
  ],
  controllers: [PadelCourtController],
  providers: [PadelCourtService],
  exports: [PadelCourtService],
})
export class PadelCourtModule {}
