import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IamModule } from '../iam/iam.module';
import { BusinessesController } from './businesses.controller';
import { BusinessLocation } from './entities/business-location.entity';
import { BusinessMembership } from './entities/business-membership.entity';
import { Business } from './entities/business.entity';
import { BusinessesService } from './businesses.service';

@Module({
  imports: [
    IamModule,
    TypeOrmModule.forFeature([Business, BusinessMembership, BusinessLocation]),
  ],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
