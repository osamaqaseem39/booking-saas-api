import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { TurfCourt } from '../turf/entities/turf-court.entity';
import { TurfBooking } from '../turf-booking/entities/turf-booking.entity';
import { TurfAvailabilityController } from './turf-availability.controller';
import { TurfAvailabilityService } from './turf-availability.service';
import { TurfSlotGeneratorService } from './turf-slot-generator.service';

@Module({
  imports: [TypeOrmModule.forFeature([TurfCourt, TurfBooking, BusinessLocation])],
  controllers: [TurfAvailabilityController],
  providers: [TurfAvailabilityService, TurfSlotGeneratorService],
})
export class TurfAvailabilityModule {}
