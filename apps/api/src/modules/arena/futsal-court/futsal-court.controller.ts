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
import { CurrentTenant } from '../../../tenancy/tenant-context.decorator';
import { TenantContext } from '../../../tenancy/tenant-context.interface';
import { CreateFutsalCourtDto } from './dto/create-futsal-court.dto';
import { UpdateFutsalCourtDto } from './dto/update-futsal-court.dto';
import { FutsalCourtService } from './futsal-court.service';

@Controller('arena/futsal-courts')
@UseGuards(RolesGuard)
export class FutsalCourtController {
  constructor(private readonly service: FutsalCourtService) {}

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
    const tenantId = tenant?.tenantId?.trim();
    if (!tenantId || tenantId === 'public') {
      return this.service.findOnePublicById(id);
    }
    return this.service.findOne(tenantId, id);
  }

  @Post()
  @Roles('platform-owner', 'business-admin')
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateFutsalCourtDto,
  ) {
    return this.service.create(tenant.tenantId, dto);
  }

  @Patch(':id')
  @Roles('platform-owner', 'business-admin')
  patch(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFutsalCourtDto,
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
