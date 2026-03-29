import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../../businesses/businesses.module';
import { IamModule } from '../../iam/iam.module';
import { CricketIndoorController } from './cricket-indoor.controller';
import { CricketIndoorService } from './cricket-indoor.service';
import { CricketIndoorCourt } from './entities/cricket-indoor-court.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CricketIndoorCourt]),
    IamModule,
    BusinessesModule,
  ],
  controllers: [CricketIndoorController],
  providers: [CricketIndoorService],
  exports: [CricketIndoorService],
})
export class CricketIndoorModule {}
