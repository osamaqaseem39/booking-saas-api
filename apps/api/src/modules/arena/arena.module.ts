import { Module } from '@nestjs/common';
import { ArenaMetaController } from './arena-meta.controller';
import { CricketCourtModule } from './cricket-court/cricket-court.module';
import { FutsalCourtModule } from './futsal-court/futsal-court.module';
import { GamingStationModule } from './gaming-station/gaming-station.module';
import { PadelCourtModule } from './padel-court/padel-court.module';

@Module({
  imports: [
    CricketCourtModule,
    FutsalCourtModule,
    PadelCourtModule,
    GamingStationModule,
  ],
  controllers: [ArenaMetaController],
})
export class ArenaModule {}
