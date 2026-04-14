import { Module } from '@nestjs/common';
import { ArenaMetaController } from './arena-meta.controller';
import { ArenaTurfTwinLinkModule } from './arena-turf-twin-link.module';
import { CricketCourtModule } from './cricket-court/cricket-court.module';
import { FutsalCourtModule } from './futsal-court/futsal-court.module';
import { GamingStationModule } from './gaming-station/gaming-station.module';
import { IamModule } from '../iam/iam.module';
import { PadelCourtModule } from './padel-court/padel-court.module';
import { PublicArenaFacilityController } from './public-arena-facility.controller';

@Module({
  imports: [
    IamModule,
    ArenaTurfTwinLinkModule,
    CricketCourtModule,
    FutsalCourtModule,
    PadelCourtModule,
    GamingStationModule,
  ],
  controllers: [ArenaMetaController, PublicArenaFacilityController],
})
export class ArenaModule {}
