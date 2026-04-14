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
import { Roles } from '../iam/authz/roles.decorator';
import { RolesGuard } from '../iam/authz/roles.guard';
import { CurrentTenant } from '../../tenancy/tenant-context.decorator';
import type { TenantContext } from '../../tenancy/tenant-context.interface';
import { CreateCricketCourtDto } from './cricket-court/dto/create-cricket-court.dto';
import { UpdateCricketCourtDto } from './cricket-court/dto/update-cricket-court.dto';
import { ArenaTurfSurfacesService } from './cricket-court/cricket-court.service';
import { CreateFutsalCourtDto } from './futsal-court/dto/create-futsal-court.dto';
import { UpdateFutsalCourtDto } from './futsal-court/dto/update-futsal-court.dto';
import { ArenaTurfRowsService } from './futsal-court/futsal-court.service';

/**
 * Unified arena turf HTTP API. Storage rows live in `futsal_courts`; `surface` routes serve the
 * cricket projection (including dual-sport rows).
 */
@Controller('arena/turf-courts')
@UseGuards(RolesGuard)
export class ArenaTurfCourtsController {
  constructor(
    private readonly rows: ArenaTurfRowsService,
    private readonly surfaces: ArenaTurfSurfacesService,
  ) {}

  @Get()
  listStorage(
    @CurrentTenant() tenant: TenantContext,
    @Query('businessLocationId') businessLocationId?: string,
  ) {
    return this.rows.list(tenant.tenantId, businessLocationId);
  }

  @Get('surface')
  listSurface(
    @CurrentTenant() tenant: TenantContext,
    @Query('businessLocationId') businessLocationId?: string,
  ) {
    return this.surfaces.list(tenant.tenantId, businessLocationId);
  }

  @Get('surface/:id')
  oneSurface(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.surfaces.findOne(tenant.tenantId, id);
  }

  @Get(':id')
  oneStorage(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const tenantId = tenant?.tenantId?.trim();
    if (!tenantId || tenantId === 'public') {
      return this.rows.findOnePublicById(id);
    }
    return this.rows.findOne(tenantId, id);
  }

  @Post()
  @Roles('platform-owner', 'business-admin')
  createStorage(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateFutsalCourtDto,
  ) {
    return this.rows.create(tenant.tenantId, dto);
  }

  @Post('surface')
  @Roles('platform-owner', 'business-admin')
  createSurface(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCricketCourtDto,
  ) {
    return this.surfaces.create(tenant.tenantId, dto);
  }

  @Patch('surface/:id')
  @Roles('platform-owner', 'business-admin')
  patchSurface(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCricketCourtDto,
  ) {
    return this.surfaces.update(tenant.tenantId, id, dto);
  }

  @Patch(':id')
  @Roles('platform-owner', 'business-admin')
  patchStorage(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFutsalCourtDto,
  ) {
    return this.rows.update(tenant.tenantId, id, dto);
  }

  @Delete('surface/:id')
  @Roles('platform-owner', 'business-admin')
  removeSurface(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.surfaces.remove(tenant.tenantId, id);
  }

  @Delete(':id')
  @Roles('platform-owner', 'business-admin')
  removeStorage(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rows.remove(tenant.tenantId, id);
  }
}
