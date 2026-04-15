import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentTenant } from '../../../tenancy/tenant-context.decorator';
import { TenantContext } from '../../../tenancy/tenant-context.interface';
import { RolesGuard } from '../../iam/authz/roles.guard';
import { TurfService } from './turf.service';

@Controller('arena/turf-courts')
@UseGuards(RolesGuard)
export class TurfArenaController {
  constructor(private readonly turfService: TurfService) {}

  @Get()
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query('businessLocationId') businessLocationId?: string,
  ) {
    return this.turfService.listByTenant(tenant.tenantId, businessLocationId);
  }
}
