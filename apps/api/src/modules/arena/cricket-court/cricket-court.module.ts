import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsModule } from '../../bookings/bookings.module';
import { BusinessesModule } from '../../businesses/businesses.module';
import { IamModule } from '../../iam/iam.module';
import { CricketCourt } from './entities/cricket-court.entity';
import { CricketCourtController } from './cricket-court.controller';
import { CricketCourtService } from './cricket-court.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CricketCourt]),
    IamModule,
    BusinessesModule,
    BookingsModule,
  ],
  controllers: [CricketCourtController],
  providers: [CricketCourtService],
  exports: [CricketCourtService],
})
export class CricketCourtModule {}
