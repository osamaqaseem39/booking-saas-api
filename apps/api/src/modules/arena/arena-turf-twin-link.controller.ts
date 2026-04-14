import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentTenant } from '../../tenancy/tenant-context.decorator';
import type { TenantContext } from '../../tenancy/tenant-context.interface';
import { Roles } from '../iam/authz/roles.decorator';
import { RolesGuard } from '../iam/authz/roles.guard';
import {
  CreateTurfTwinLinkDto,
  RemoveTurfTwinLinkDto,
} from './dto/upsert-turf-twin-link.dto';

@Controller('arena/turf-twin-links')
@UseGuards(RolesGuard)
export class ArenaTurfTwinLinkController {
  @Post('link')
  @Roles('platform-owner', 'business-admin')
  async link(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateTurfTwinLinkDto,
  ) {
    void tenant;
    void dto;
    throw new BadRequestException('Field linking has been removed.');
  }

  @Post('unlink')
  @Roles('platform-owner', 'business-admin')
  async unlink(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: RemoveTurfTwinLinkDto,
  ) {
    void tenant;
    void dto;
    throw new BadRequestException('Field linking has been removed.');
  }
}
