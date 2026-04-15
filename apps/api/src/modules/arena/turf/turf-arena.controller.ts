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
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { CurrentTenant } from '../../../tenancy/tenant-context.decorator';
import { TenantContext } from '../../../tenancy/tenant-context.interface';
import { Roles } from '../../iam/authz/roles.decorator';
import { RolesGuard } from '../../iam/authz/roles.guard';
import { TurfService } from './turf.service';
import { TURF_SPORT_TYPES, TurfSportType } from './turf.types';

class ListTurfCourtsQueryDto {
  @IsOptional()
  @IsUUID('4')
  businessLocationId?: string;

  @IsOptional()
  @IsIn(TURF_SPORT_TYPES)
  sportType?: TurfSportType;
}

@Controller(['arena/turf-courts', 'arena/turf-court'])
@UseGuards(RolesGuard)
export class TurfArenaController {
  constructor(private readonly turfService: TurfService) {}

  @Get()
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListTurfCourtsQueryDto,
  ) {
    return this.turfService.listByTenant(
      tenant.tenantId,
      query.businessLocationId,
      query.sportType,
    );
  }

  @Post()
  @Roles('platform-owner', 'business-admin')
  create(@CurrentTenant() tenant: TenantContext, @Body() body: Record<string, unknown>) {
    return this.turfService.createByTenant(tenant.tenantId, body);
  }

  @Get(':id')
  one(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.turfService.findOneByTenant(tenant.tenantId, id);
  }

  @Patch(':id')
  @Roles('platform-owner', 'business-admin')
  patch(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.turfService.updateByTenant(tenant.tenantId, id, body);
  }

  @Delete(':id')
  @Roles('platform-owner', 'business-admin')
  remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.turfService.removeByTenant(tenant.tenantId, id);
  }
}
