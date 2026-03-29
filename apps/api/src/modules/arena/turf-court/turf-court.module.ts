import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../../businesses/businesses.module';
import { IamModule } from '../../iam/iam.module';
import { TurfCourt } from './entities/turf-court.entity';
import { TurfCourtController } from './turf-court.controller';
import { TurfCourtService } from './turf-court.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TurfCourt]),
    IamModule,
    BusinessesModule,
  ],
  controllers: [TurfCourtController],
  providers: [TurfCourtService],
  exports: [TurfCourtService],
})
export class TurfCourtModule {}
