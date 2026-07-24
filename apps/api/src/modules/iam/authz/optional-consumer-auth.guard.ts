import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class OptionalConsumerAuthGuard implements CanActivate {
  constructor(@Optional() private readonly jwtService?: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ext = request as Request & { userId?: string };

    if (!ext.userId?.trim()) {
      const userId = await this.resolveUserId(request);
      if (userId) ext.userId = userId;
    }

    return true;
  }

  private async resolveUserId(request: Request): Promise<string | undefined> {
    const authHeader = request.header('Authorization')?.trim();
    if (!authHeader?.startsWith('Bearer ')) {
      return undefined;
    }
    if (!this.jwtService) return undefined;

    const token = authHeader.slice('Bearer '.length);
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: string;
        userId?: string;
        typ?: string;
      }>(token);
      if (payload.typ === 'refresh') return undefined;
      return payload.sub ?? payload.userId;
    } catch {
      return undefined;
    }
  }
}
