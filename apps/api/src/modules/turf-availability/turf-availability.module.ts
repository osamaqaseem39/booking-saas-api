import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { TurfCourt } from '../turf/entities/turf-court.entity';
import { TurfAvailabilityController } from './turf-availability.controller';
import { TurfAvailabilityService } from './turf-availability.service';
import { TurfSlotGeneratorService } from './turf-slot-generator.service';

@Module({
  imports: [TypeOrmModule.forFeature([TurfCourt, Booking, BusinessLocation])],
  controllers: [TurfAvailabilityController],
  providers: [TurfAvailabilityService, TurfSlotGeneratorService],
})
export class TurfAvailabilityModule {}
