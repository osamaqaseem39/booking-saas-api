import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { BusinessMembership } from '../businesses/entities/business-membership.entity';
import { IamModule } from '../iam/iam.module';
import { CanteenItem } from './entities/canteen-item.entity';
import { CanteenController } from './canteen.controller';
import { CanteenService } from './canteen.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CanteenItem,
      BusinessLocation,
      BusinessMembership,
    ]),
    IamModule,
  ],
  controllers: [CanteenController],
  providers: [CanteenService],
})
export class CanteenModule {}
