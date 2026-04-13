import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsModule } from '../../bookings/bookings.module';
import { BusinessesModule } from '../../businesses/businesses.module';
import { IamModule } from '../../iam/iam.module';
import { PadelCourt } from './entities/padel-court.entity';
import { PadelCourtController } from './padel-court.controller';
import { PadelCourtService } from './padel-court.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PadelCourt]),
    IamModule,
    BusinessesModule,
    BookingsModule,
  ],
  controllers: [PadelCourtController],
  providers: [PadelCourtService],
  exports: [PadelCourtService],
})
export class PadelCourtModule {}
