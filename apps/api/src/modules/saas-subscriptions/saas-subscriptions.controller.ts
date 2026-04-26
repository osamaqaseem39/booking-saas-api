import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentTenant } from '../../tenancy/tenant-context.decorator';
import type { TenantContext } from '../../tenancy/tenant-context.interface';
import { Roles } from '../iam/authz/roles.decorator';
import { RolesGuard } from '../iam/authz/roles.guard';
import { IamService } from '../iam/iam.service';
import { EntitlementsService } from './entitlements.service';

@Controller('saas')
@UseGuards(RolesGuard)
export class SaasSubscriptionsController {
  constructor(
    private readonly entitlementsService: EntitlementsService,
    private readonly iamService: IamService,
  ) {}

  /**
   * Effective plan and feature flags for the active tenant (x-tenant-id).
   * Platform owners may pass `tenantId` when the header is omitted or `public`.
   */
  @Get('entitlements')
  @Roles('platform-owner', 'business-admin', 'location-admin', 'business-staff')
  async getEntitlements(
    @Req() req: Request,
    @CurrentTenant() tenant: TenantContext,
    @Query('tenantId') tenantIdQuery?: string,
  ) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) throw new UnauthorizedException('Missing user');

    const isPlatformOwner = await this.iamService.hasAnyRole(userId, [
      'platform-owner',
    ]);

    let tenantId = tenant?.tenantId?.trim() || 'public';
    if ((tenantId === 'public' || !tenantId) && isPlatformOwner) {
      const q = tenantIdQuery?.trim();
      if (q) tenantId = q;
    }

    if (!tenantId || tenantId === 'public') {
      throw new BadRequestException(
        'Send x-tenant-id (or tenantId query for platform-owner) to load entitlements',
      );
    }

    return this.entitlementsService.getSnapshotForTenant(tenantId);
  }
}
