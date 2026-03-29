import { Module } from '@nestjs/common';
import { FacilityTypesModule } from '../facility-types/facility-types.module';
import { SubFacilityTypesController } from './sub-facility-types.controller';
import { SubFacilityTypesService } from './sub-facility-types.service';

@Module({
  imports: [FacilityTypesModule],
  controllers: [SubFacilityTypesController],
  providers: [SubFacilityTypesService],
})
export class SubFacilityTypesModule {}
