import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../../businesses/businesses.module';
import { IamModule } from '../../iam/iam.module';
import { TurfCourt } from './entities/turf-court.entity';
import { TurfArenaController } from './turf-arena.controller';
import { TurfController } from './turf.controller';
import { TurfService } from './turf.service';

@Module({
  imports: [TypeOrmModule.forFeature([TurfCourt]), BusinessesModule, IamModule],
  controllers: [TurfController, TurfArenaController],
  providers: [TurfService],
  exports: [TurfService, TypeOrmModule],
})
export class TurfModule {}
