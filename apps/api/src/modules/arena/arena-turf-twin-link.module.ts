import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArenaTurfTwinLinkService } from './arena-turf-twin-link.service';
import { CricketCourt } from './cricket-court/entities/cricket-court.entity';
import { FutsalCourt } from './futsal-court/entities/futsal-court.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FutsalCourt, CricketCourt])],
  providers: [ArenaTurfTwinLinkService],
  exports: [ArenaTurfTwinLinkService],
})
export class ArenaTurfTwinLinkModule {}
