import { Module } from '@nestjs/common';
import { ArenaMetaController } from './arena-meta.controller';
import { CricketIndoorModule } from './cricket-indoor/cricket-indoor.module';
import { FutsalFieldModule } from './futsal-field/futsal-field.module';
import { PadelCourtModule } from './padel-court/padel-court.module';
import { TurfCourtModule } from './turf-court/turf-court.module';

@Module({
  imports: [
    CricketIndoorModule,
    FutsalFieldModule,
    PadelCourtModule,
    TurfCourtModule,
  ],
  controllers: [ArenaMetaController],
})
export class ArenaModule {}
