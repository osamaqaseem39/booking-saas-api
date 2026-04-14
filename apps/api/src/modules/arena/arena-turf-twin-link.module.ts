import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IamModule } from '../iam/iam.module';
import { ArenaTurfTwinLinkController } from './arena-turf-twin-link.controller';
import { ArenaTurfTwinLinkService } from './arena-turf-twin-link.service';
import { CricketCourt } from './cricket-court/entities/cricket-court.entity';
import { FutsalCourt } from './futsal-court/entities/futsal-court.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FutsalCourt, CricketCourt]),
    IamModule,
  ],
  controllers: [ArenaTurfTwinLinkController],
  providers: [ArenaTurfTwinLinkService],
  exports: [ArenaTurfTwinLinkService],
})
export class ArenaTurfTwinLinkModule {}
