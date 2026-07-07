import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsModule } from '../../bookings/bookings.module';
import { BusinessesModule } from '../../businesses/businesses.module';
import { IamModule } from '../../iam/iam.module';
import { SaasSubscriptionsModule } from '../../saas-subscriptions/saas-subscriptions.module';
import { TableTennisCourt } from './entities/table-tennis-court.entity';
import { TableTennisCourtController } from './table-tennis-court.controller';
import { TableTennisCourtService } from './table-tennis-court.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TableTennisCourt]),
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
