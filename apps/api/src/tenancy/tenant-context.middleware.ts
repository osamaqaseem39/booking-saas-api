import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { TenantContext } from './tenant-context.interface';

type TenantRequest = Request & { tenantContext?: TenantContext };

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: TenantRequest, _res: Response, next: NextFunction): void {
    const tenantIdHeader = req.header('x-tenant-id')?.trim();
    req.tenantContext = {
      tenantId: tenantIdHeader || 'public',
    };
    next();
  }
}
