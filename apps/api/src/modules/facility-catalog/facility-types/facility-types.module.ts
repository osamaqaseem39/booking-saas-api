import { Module } from '@nestjs/common';
import { FacilityTypesController } from './facility-types.controller';
import { FacilityTypesService } from './facility-types.service';

@Module({
  controllers: [FacilityTypesController],
  providers: [FacilityTypesService],
  exports: [FacilityTypesService],
})
export class FacilityTypesModule {}
