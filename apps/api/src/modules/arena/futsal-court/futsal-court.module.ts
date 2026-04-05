import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../../businesses/businesses.module';
import { IamModule } from '../../iam/iam.module';
import { ArenaTurfTwinLinkModule } from '../arena-turf-twin-link.module';
import { FutsalCourt } from './entities/futsal-court.entity';
import { FutsalCourtController } from './futsal-court.controller';
import { FutsalCourtService } from './futsal-court.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FutsalCourt]),
    IamModule,
    BusinessesModule,
    ArenaTurfTwinLinkModule,
  ],
  controllers: [FutsalCourtController],
  providers: [FutsalCourtService],
  exports: [FutsalCourtService],
})
export class FutsalCourtModule {}
