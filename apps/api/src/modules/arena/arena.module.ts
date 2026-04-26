import { Module } from '@nestjs/common';
import { ArenaMetaController } from './meta/arena-meta.controller';
import { IamModule } from '../iam/iam.module';
import { PadelCourtModule } from './padel-court/padel-court.module';
import { PublicArenaFacilityController } from './public/public-arena-facility.controller';
import { TableTennisCourtModule } from './table-tennis-court/table-tennis-court.module';
import { TurfModule } from './turf/turf.module';

@Module({
  imports: [
    IamModule,
    PadelCourtModule,
    TableTennisCourtModule,
    TurfModule,
  ],
  controllers: [ArenaMetaController, PublicArenaFacilityController],
})
export class ArenaModule {}
