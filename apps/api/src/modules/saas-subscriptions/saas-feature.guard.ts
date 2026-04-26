import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { TenantContext } from '../../tenancy/tenant-context.interface';
import { EntitlementsService } from './entitlements.service';
import { SAAS_FEATURES_KEY } from './require-saas-feature.decorator';
import type { SaasFeature } from './saas-subscription.types';

type TenantRequest = Request & { tenantContext?: TenantContext; userId?: string };

@Injectable()
export class SaasFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<SaasFeature[] | undefined>(
      SAAS_FEATURES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const req = context.switchToHttp().getRequest<TenantRequest>();
    const userId = req.userId?.trim();
    if (!userId) {
      throw new UnauthorizedException('Missing authentication');
    }

    const tenantId = req.tenantContext?.tenantId ?? 'public';
    await this.entitlementsService.assertFeaturesAllowed(
      tenantId,
      userId,
      required,
    );
    return true;
  }
}
