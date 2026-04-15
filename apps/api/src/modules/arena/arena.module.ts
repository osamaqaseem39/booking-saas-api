import { Module } from '@nestjs/common';
import { ArenaMetaController } from './arena-meta.controller';
import { GamingStationModule } from './gaming-station/gaming-station.module';
import { IamModule } from '../iam/iam.module';
import { PadelCourtModule } from './padel-court/padel-court.module';
import { PublicArenaFacilityController } from './public-arena-facility.controller';

@Module({
  imports: [
    IamModule,
    PadelCourtModule,
    GamingStationModule,
  ],
  controllers: [ArenaMetaController, PublicArenaFacilityController],
})
export class ArenaModule {}
