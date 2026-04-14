import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentTenant } from '../../tenancy/tenant-context.decorator';
import type { TenantContext } from '../../tenancy/tenant-context.interface';
import { Roles } from '../iam/authz/roles.decorator';
import { RolesGuard } from '../iam/authz/roles.guard';
import { ArenaTurfTwinLinkService } from './arena-turf-twin-link.service';
import {
  CreateTurfTwinLinkDto,
  RemoveTurfTwinLinkDto,
} from './dto/upsert-turf-twin-link.dto';

@Controller('arena/turf-twin-links')
@UseGuards(RolesGuard)
export class ArenaTurfTwinLinkController {
  constructor(private readonly turfTwinLinkService: ArenaTurfTwinLinkService) {}

  @Post()
  @Roles('platform-owner', 'business-admin')
  async createLink(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateTurfTwinLinkDto,
  ) {
    return this.turfTwinLinkService.linkCourts(
      tenant.tenantId,
      dto.futsalCourtId,
      dto.cricketCourtId,
    );
  }

  @Post('unlink')
  @Roles('platform-owner', 'business-admin')
  async unlink(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: RemoveTurfTwinLinkDto,
  ) {
    return this.turfTwinLinkService.unlinkCourt(
      tenant.tenantId,
      dto.courtKind,
      dto.courtId,
    );
  }
}
