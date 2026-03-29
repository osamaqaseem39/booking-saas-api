import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SystemRole } from '../iam.constants';
import { IamService } from '../iam.service';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly iamService: IamService,
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
    const userId = request.header('x-user-id');
    if (!userId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }

    const allowed = await this.iamService.hasAnyRole(userId, requiredRoles);
    if (!allowed) {
      throw new ForbiddenException(
        `User ${userId} does not have required role for this endpoint`,
      );
    }

    return true;
  }
}
