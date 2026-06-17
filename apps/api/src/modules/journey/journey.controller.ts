import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { isUUID } from 'class-validator';
import { CurrentTenant } from '../../tenancy/tenant-context.decorator';
import type { TenantContext } from '../../tenancy/tenant-context.interface';
import { ConsumerAuthGuard } from '../iam/authz/consumer-auth.guard';
import { JourneyService } from './journey.service';

@Controller('journey')
@UseGuards(ConsumerAuthGuard)
export class JourneyController {
  constructor(private readonly journeyService: JourneyService) {}

  private userId(req: Request): string {
    const id = (req as Request & { userId?: string }).userId?.trim();
    if (!id) throw new UnauthorizedException('Missing user');
    return id;
  }

  private tenantId(tenant: TenantContext): string | undefined {
    const id = tenant?.tenantId?.trim() ?? '';
    return isUUID(id, 4) ? id : undefined;
  }

  @Post('events')
  trackEvent(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
    @Body()
    dto: {
      eventType: string;
      sessionId?: string;
      properties?: Record<string, unknown>;
      occurredAt?: string;
    },
  ) {
    return this.journeyService.trackEvent(
      this.userId(req),
      this.tenantId(tenant),
      dto,
    );
  }

  @Get('me/profile')
  profile(@Req() req: Request) {
    return this.journeyService.getProfile(this.userId(req));
  }

  @Get('me/timeline')
  timeline(
    @Req() req: Request,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('types') types?: string,
  ) {
    return this.journeyService.getTimeline(this.userId(req), {
      page,
      limit,
      types,
    });
  }
}
