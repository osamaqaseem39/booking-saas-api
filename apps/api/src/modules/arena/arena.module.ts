import { Module } from '@nestjs/common';
import { ArenaMetaController } from './arena-meta.controller';
import { IamModule } from '../iam/iam.module';
import { PadelCourtModule } from './padel-court/padel-court.module';
import { PublicArenaFacilityController } from './public-arena-facility.controller';
import { TurfModule } from './turf/turf.module';

@Module({
  imports: [
    IamModule,
    PadelCourtModule,
    TurfModule,
  ],
  controllers: [ArenaMetaController, PublicArenaFacilityController],
})
export class ArenaModule {}
