import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { Business } from '../businesses/entities/business.entity';
import { TurfCourt } from '../turf/entities/turf-court.entity';
import { TurfSlotGeneratorService } from '../turf-availability/turf-slot-generator.service';
import { TurfBookingController } from './turf-booking.controller';
import { TurfBooking } from './entities/turf-booking.entity';
import { TurfBookingService } from './turf-booking.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TurfBooking, TurfCourt, BusinessLocation, Business]),
  ],
  controllers: [TurfBookingController],
  providers: [TurfBookingService, TurfSlotGeneratorService],
  exports: [TurfBookingService, TypeOrmModule],
})
export class TurfBookingModule {}
