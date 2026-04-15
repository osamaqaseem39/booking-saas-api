import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { Business } from '../businesses/entities/business.entity';
import { BookingsModule } from '../bookings/bookings.module';
import { TurfCourt } from '../turf/entities/turf-court.entity';
import { TurfSlotGeneratorService } from '../turf-availability/turf-slot-generator.service';
import { TurfBookingController } from './turf-booking.controller';
import { TurfBookingService } from './turf-booking.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TurfCourt, BusinessLocation, Business]),
    BookingsModule,
  ],
  controllers: [TurfBookingController],
  providers: [TurfBookingService, TurfSlotGeneratorService],
  exports: [TurfBookingService, TypeOrmModule],
})
export class TurfBookingModule {}
