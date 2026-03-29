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
import { CreateFutsalFieldDto } from './dto/create-futsal-field.dto';
import { UpdateFutsalFieldDto } from './dto/update-futsal-field.dto';
import { FutsalFieldService } from './futsal-field.service';

@Controller('arena/futsal-field')
@UseGuards(RolesGuard)
export class FutsalFieldController {
  constructor(private readonly service: FutsalFieldService) {}

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
  @Roles('platform-owner', 'business-admin')
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateFutsalFieldDto,
  ) {
    return this.service.create(tenant.tenantId, dto);
  }

  @Patch(':id')
  @Roles('platform-owner', 'business-admin')
  patch(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFutsalFieldDto,
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
