import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsModule } from '../../bookings/bookings.module';
import { BusinessesModule } from '../../businesses/businesses.module';
import { IamModule } from '../../iam/iam.module';
import { FutsalCourt } from './entities/futsal-court.entity';
import { ArenaTurfRowsService } from './futsal-court.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FutsalCourt]),
    IamModule,
    BusinessesModule,
    BookingsModule,
  ],
  controllers: [],
  providers: [ArenaTurfRowsService],
  exports: [ArenaTurfRowsService],
})
export class FutsalCourtModule {}
