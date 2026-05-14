import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CanteenItem } from './entities/canteen-item.entity';
import { CanteenService } from './canteen.service';
import { CanteenController } from './canteen.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CanteenItem])],
  controllers: [CanteenController],
  providers: [CanteenService],
  exports: [CanteenService],
})
export class CanteenModule {}
