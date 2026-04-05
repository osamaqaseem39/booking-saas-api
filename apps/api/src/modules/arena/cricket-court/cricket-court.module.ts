import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../../businesses/businesses.module';
import { IamModule } from '../../iam/iam.module';
import { ArenaTurfTwinLinkModule } from '../arena-turf-twin-link.module';
import { CricketCourt } from './entities/cricket-court.entity';
import { CricketCourtController } from './cricket-court.controller';
import { CricketCourtService } from './cricket-court.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CricketCourt]),
    IamModule,
    BusinessesModule,
    ArenaTurfTwinLinkModule,
  ],
  controllers: [CricketCourtController],
  providers: [CricketCourtService],
  exports: [CricketCourtService],
})
export class CricketCourtModule {}
