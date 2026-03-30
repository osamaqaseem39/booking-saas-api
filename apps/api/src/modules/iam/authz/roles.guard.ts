import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
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
    private readonly iamService: IamService,
    private readonly jwtService: JwtService,
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
    const authHeader = request.header('Authorization')?.trim();
    let userId: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      try {
        const payload = await this.jwtService.verifyAsync<{
          sub?: string;
          userId?: string;
        }>(token);
        userId = payload.sub ?? payload.userId;
      } catch {
        throw new UnauthorizedException('Invalid token');
      }
    }

    if (!userId) {
      userId = request.header('x-user-id')?.trim();
    }

    if (!userId) {
      throw new UnauthorizedException('Missing authentication');
    }

    // Attach for downstream controllers.
    (request as Request & { userId?: string }).userId = userId;

    const allowed = await this.iamService.hasAnyRole(userId, requiredRoles);
    if (!allowed) {
      throw new ForbiddenException(
        `User ${userId} does not have required role for this endpoint`,
      );
    }

    return true;
  }
}
