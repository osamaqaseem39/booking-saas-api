import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsModule } from '../../bookings/bookings.module';
import { BusinessesModule } from '../../businesses/businesses.module';
import { IamModule } from '../../iam/iam.module';
import { FutsalCourt } from '../futsal-court/entities/futsal-court.entity';
import { CricketCourt } from './entities/cricket-court.entity';
import { ArenaTurfSurfacesService } from './cricket-court.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CricketCourt, FutsalCourt]),
    IamModule,
    BusinessesModule,
    BookingsModule,
  ],
  controllers: [],
  providers: [ArenaTurfSurfacesService],
  exports: [ArenaTurfSurfacesService],
})
export class CricketCourtModule {}
