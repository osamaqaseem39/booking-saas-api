import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentTenant } from '../../../tenancy/tenant-context.decorator';
import { TenantContext } from '../../../tenancy/tenant-context.interface';
import { CreateFacilityTypeDto } from './dto/create-facility-type.dto';
import { FacilityTypesService } from './facility-types.service';

@Controller('facility-types')
export class FacilityTypesController {
  constructor(private readonly facilityTypesService: FacilityTypesService) {}

  @Get()
  list(@CurrentTenant() tenant: TenantContext) {
    return this.facilityTypesService.list(tenant.tenantId);
  }

  @Post()
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateFacilityTypeDto,
  ) {
    return this.facilityTypesService.create(tenant.tenantId, dto);
  }
}
