import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../iam/authz/roles.decorator';
import { RolesGuard } from '../../iam/authz/roles.guard';
import { RequireSaasFeatures } from '../../saas-subscriptions/require-saas-feature.decorator';
import { SaasFeatureGuard } from '../../saas-subscriptions/saas-feature.guard';
import { CurrentTenant } from '../../../tenancy/tenant-context.decorator';
import { TenantContext } from '../../../tenancy/tenant-context.interface';
import { CreatePadelCourtDto } from './dto/create-padel-court.dto';
import { UpdatePadelCourtDto } from './dto/update-padel-court.dto';
import { PadelCourtService } from './padel-court.service';

@Controller('arena/padel-court')
@UseGuards(RolesGuard, SaasFeatureGuard)
@RequireSaasFeatures('padel_module')
export class PadelCourtController {
  constructor(private readonly service: PadelCourtService) {}

  @Get(':id')
  one(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(tenant.tenantId, id);
  }

  @Post()
  @Roles('platform-owner', 'business-admin', 'location-admin')
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePadelCourtDto,
  ) {
    return this.service.create(tenant.tenantId, dto);
  }

  @Patch(':id')
  @Roles('platform-owner', 'business-admin', 'location-admin')
  patch(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePadelCourtDto,
  ) {
    return this.service.update(tenant.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('platform-owner', 'business-admin', 'location-admin')
  remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(tenant.tenantId, id);
  }
}
