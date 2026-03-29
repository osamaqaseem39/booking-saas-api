import { Module } from '@nestjs/common';
import { FacilityTypesModule } from './facility-types/facility-types.module';
import { SubFacilityTypesModule } from './sub-facility-types/sub-facility-types.module';

@Module({
  imports: [FacilityTypesModule, SubFacilityTypesModule],
})
export class FacilityCatalogModule {}
