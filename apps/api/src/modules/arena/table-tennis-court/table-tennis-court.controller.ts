import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../iam/authz/roles.decorator';
import { RolesGuard } from '../../iam/authz/roles.guard';
import { RequireSaasFeatures } from '../../saas-subscriptions/require-saas-feature.decorator';
import { SaasFeatureGuard } from '../../saas-subscriptions/saas-feature.guard';
import { CurrentTenant } from '../../../tenancy/tenant-context.decorator';
import { TenantContext } from '../../../tenancy/tenant-context.interface';
import { CreateTableTennisCourtDto } from './dto/create-table-tennis-court.dto';
import { UpdateTableTennisCourtDto } from './dto/update-table-tennis-court.dto';
import { TableTennisCourtService } from './table-tennis-court.service';

@Controller('arena/table-tennis-court')
@UseGuards(RolesGuard, SaasFeatureGuard)
@RequireSaasFeatures('table_tennis_module')
export class TableTennisCourtController {
  constructor(private readonly service: TableTennisCourtService) {}

  @Get()
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query('businessLocationId') businessLocationId?: string,
  ) {
    return this.service.list(tenant.tenantId, businessLocationId);
  }

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
    @Body() dto: CreateTableTennisCourtDto,
  ) {
    return this.service.create(tenant.tenantId, dto);
  }

  @Patch(':id')
  @Roles('platform-owner', 'business-admin', 'location-admin')
  patch(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTableTennisCourtDto,
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
