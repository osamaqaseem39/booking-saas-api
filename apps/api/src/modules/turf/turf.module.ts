import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TurfCourt } from './entities/turf-court.entity';
import { TurfController } from './turf.controller';
import { TurfService } from './turf.service';

@Module({
  imports: [TypeOrmModule.forFeature([TurfCourt])],
  controllers: [TurfController],
  providers: [TurfService],
  exports: [TurfService, TypeOrmModule],
})
export class TurfModule {}
