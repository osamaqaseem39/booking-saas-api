import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { OptionalConsumerAuthGuard } from '../iam/authz/optional-consumer-auth.guard';
import { Roles } from '../iam/authz/roles.decorator';
import { RolesGuard } from '../iam/authz/roles.guard';
import { AnalyticsService } from './analytics.service';
import type { AnalyticsEventInput } from './analytics.utils';
import { AnalyticsReportQueryDto } from './dto/analytics-report-query.dto';
import { IngestAnalyticsEventsDto } from './dto/ingest-analytics-events.dto';

type AuthedRequest = Request & { userId?: string };

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('events')
  @HttpCode(202)
  @UseGuards(OptionalConsumerAuthGuard)
  ingest(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthedRequest,
    @Body() dto: IngestAnalyticsEventsDto,
  ) {
    const ip =
      (req.ip || req.socket?.remoteAddress || '').toString() || null;
    const userAgent = req.get('user-agent');
    const tenantHeader = tenant?.tenantId?.trim() ?? '';
    const tenantId = isUUID(tenantHeader, 4) ? tenantHeader : null;

    return this.analyticsService.ingestBatch({
      tenantId,
      userId: req.userId?.trim() || null,
      events: dto.events as AnalyticsEventInput[],
      sourceIp: ip,
      userAgent,
      source: 'mobile_client',
    });
  }

  @Get('report')
  @UseGuards(RolesGuard)
  @Roles('platform-owner', 'business-admin', 'location-admin')
  report(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthedRequest,
    @Query() query: AnalyticsReportQueryDto,
  ) {
    const id = tenant?.tenantId?.trim() ?? '';
    if (!isUUID(id, 4)) {
      throw new UnauthorizedException('Valid X-Tenant-Id required');
    }
    const userId = req.userId?.trim();
    if (!userId) throw new UnauthorizedException('Missing user');

    return this.analyticsService.getReport({
      tenantId: id,
      requesterUserId: userId,
      from: query.from,
      to: query.to,
      eventName: query.event_name,
      locationId: query.location_id,
      appVersion: query.app_version,
    });
  }
}
