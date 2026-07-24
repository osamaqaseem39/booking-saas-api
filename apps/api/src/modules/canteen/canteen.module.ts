import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { BusinessMembership } from '../businesses/entities/business-membership.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { IamModule } from '../iam/iam.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CanteenItem } from './entities/canteen-item.entity';
import { CanteenOrder } from './entities/canteen-order.entity';
import { CanteenOrderItem } from './entities/canteen-order-item.entity';
import { CanteenController } from './canteen.controller';
import { PublicCanteenController } from './public-canteen.controller';
import { CanteenService } from './canteen.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CanteenItem,
      CanteenOrder,
      CanteenOrderItem,
      BusinessLocation,
      BusinessMembership,
      Booking,
    ]),
    IamModule,
    AnalyticsModule,
  ],
  controllers: [CanteenController, PublicCanteenController],
  providers: [CanteenService],
})
export class CanteenModule {}
