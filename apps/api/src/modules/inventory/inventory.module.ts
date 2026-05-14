import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { BusinessMembership } from '../businesses/entities/business-membership.entity';
import { IamModule } from '../iam/iam.module';
import { Asset } from './entities/asset.entity';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, BusinessLocation, BusinessMembership]),
    IamModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
