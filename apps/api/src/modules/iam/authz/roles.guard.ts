import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { SystemRole } from '../iam.constants';
import { IamService } from '../iam.service';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    // Keep bootstrap resilient if a feature module forgets to import IamModule.
    @Optional() private readonly iamService?: IamService,
    // Some modules may not import/export JwtModule, so keep boot resilient.
    // If Authorization bearer token is used but JwtService isn't available,
    // we will fail the request with a 401 instead of crashing the whole app.
    @Optional() private readonly jwtService?: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const requestMethod = request.method?.toUpperCase();
    const rolesToCheck: SystemRole[] =
      requestMethod === 'GET' && !requiredRoles.includes('customer-end-user')
        ? [...requiredRoles, 'customer-end-user']
        : requiredRoles;
    const authHeader = request.header('Authorization')?.trim();
    let userId: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      if (!this.jwtService) {
        throw new UnauthorizedException(
          'Token verification not configured on server',
        );
      }
      const token = authHeader.slice('Bearer '.length);
      try {
        const payload = await this.jwtService.verifyAsync<{
          sub?: string;
          userId?: string;
          typ?: string;
        }>(token);
        if (payload.typ === 'refresh') {
          throw new UnauthorizedException('Use access token for API requests');
        }
        userId = payload.sub ?? payload.userId;
      } catch (e) {
        if (e instanceof UnauthorizedException) throw e;
        throw new UnauthorizedException('Invalid token');
      }
    }

    // Security: do not trust spoofable identity headers in normal environments.
    // Keep an explicit opt-in for local/dev troubleshooting only.
    const allowHeaderUserId =
      process.env.ALLOW_INSECURE_USER_ID_HEADER === 'true' ||
      process.env.ALLOW_INSECURE_USER_ID_HEADER === '1';
    if (!userId && allowHeaderUserId) {
      userId = request.header('x-user-id')?.trim();
    }

    if (!userId) {
      throw new UnauthorizedException('Missing authentication');
    }

    // Attach for downstream controllers.
    (request as Request & { userId?: string }).userId = userId;

    if (!this.iamService) {
      throw new InternalServerErrorException(
        'Authorization service is not configured on server',
      );
    }

    await this.iamService.assertRequesterActive(userId);

    const allowed = await this.iamService.hasAnyRole(userId, rolesToCheck);
    if (!allowed) {
      throw new ForbiddenException(
        `User ${userId} does not have required role for this endpoint`,
      );
    }

    return true;
  }
}
