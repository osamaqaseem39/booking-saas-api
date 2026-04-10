import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../../iam/authz/roles.decorator';
import { RolesGuard } from '../../iam/authz/roles.guard';
import { CurrentTenant } from '../../../tenancy/tenant-context.decorator';
import { TenantContext } from '../../../tenancy/tenant-context.interface';
import { CreateGamingStationDto } from './dto/create-gaming-station.dto';
import { UpdateGamingStationDto } from './dto/update-gaming-station.dto';
import { GamingStationService } from './gaming-station.service';
import { GamingSetupCode } from './entities/gaming-station.entity';

@Controller('gaming/stations')
@UseGuards(RolesGuard)
export class GamingStationController {
  constructor(private readonly service: GamingStationService) {}

  @Get()
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query('businessLocationId') businessLocationId?: string,
    @Query('setupCode') setupCode?: string,
  ) {
    return this.service.list(tenant.tenantId, businessLocationId, setupCode);
  }

  @Get(':id')
  one(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(tenant.tenantId, id);
  }

  @Post()
  @Roles('platform-owner', 'business-admin')
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateGamingStationDto,
  ) {
    return this.service.create(tenant.tenantId, dto);
  }

  @Patch(':id')
  @Roles('platform-owner', 'business-admin')
  patch(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGamingStationDto,
  ) {
    return this.service.update(tenant.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('platform-owner', 'business-admin')
  remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(tenant.tenantId, id);
  }
}

const TYPE_TO_PATH = {
  'gaming-pc': 'gaming/pc-stations',
  'gaming-ps5': 'gaming/ps5-stations',
  'gaming-ps4': 'gaming/ps4-stations',
  'gaming-xbox-one': 'gaming/xbox-one-stations',
  'gaming-xbox-360': 'gaming/xbox-360-stations',
  'gaming-vr': 'gaming/vr-stations',
  'gaming-steering-sim': 'gaming/steering-sim-stations',
} as const satisfies Record<GamingSetupCode, string>;

const TYPE_BASE_PATHS = Object.values(TYPE_TO_PATH);
const TYPE_ID_PATHS = TYPE_BASE_PATHS.map((p) => `${p}/:id`);

function setupCodeFromRequestPath(pathname: string): GamingSetupCode {
  const normalized = pathname.replace(/^\/+/, '');
  for (const [setupCode, path] of Object.entries(TYPE_TO_PATH) as Array<
    [GamingSetupCode, string]
  >) {
    if (normalized.startsWith(path)) return setupCode;
  }
  throw new NotFoundException('Unknown gaming station route');
}

@Controller()
@UseGuards(RolesGuard)
export class TypedGamingStationController {
  constructor(private readonly service: GamingStationService) {}

  @Get(TYPE_BASE_PATHS)
  list(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
    @Query('businessLocationId') businessLocationId?: string,
  ) {
    const setupCode = setupCodeFromRequestPath(req.path);
    return this.service.list(tenant.tenantId, businessLocationId, setupCode);
  }

  @Get(TYPE_ID_PATHS)
  one(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const setupCode = setupCodeFromRequestPath(req.path);
    return this.service.findOneBySetup(tenant.tenantId, id, setupCode);
  }

  @Post(TYPE_BASE_PATHS)
  @Roles('platform-owner', 'business-admin')
  create(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
    @Body() dto: CreateGamingStationDto,
  ) {
    const setupCode = setupCodeFromRequestPath(req.path);
    return this.service.create(tenant.tenantId, { ...dto, setupCode });
  }

  @Patch(TYPE_ID_PATHS)
  @Roles('platform-owner', 'business-admin')
  patch(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGamingStationDto,
  ) {
    const setupCode = setupCodeFromRequestPath(req.path);
    return this.service.update(tenant.tenantId, id, { ...dto, setupCode });
  }

  @Delete(TYPE_ID_PATHS)
  @Roles('platform-owner', 'business-admin')
  remove(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const setupCode = setupCodeFromRequestPath(req.path);
    return this.service.findOneBySetup(tenant.tenantId, id, setupCode).then(() =>
      this.service.remove(tenant.tenantId, id),
    );
  }
}
