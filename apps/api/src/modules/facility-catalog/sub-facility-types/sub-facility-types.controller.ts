import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentTenant } from '../../../tenancy/tenant-context.decorator';
import { TenantContext } from '../../../tenancy/tenant-context.interface';
import { CreateSubFacilityTypeDto } from './dto/create-sub-facility-type.dto';
import { SubFacilityTypesService } from './sub-facility-types.service';

@Controller('sub-facility-types')
export class SubFacilityTypesController {
  constructor(
    private readonly subFacilityTypesService: SubFacilityTypesService,
  ) {}

  @Get()
  list(@CurrentTenant() tenant: TenantContext) {
    return this.subFacilityTypesService.list(tenant.tenantId);
  }

  @Post()
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateSubFacilityTypeDto,
  ) {
    return this.subFacilityTypesService.create(tenant.tenantId, dto);
  }
}
