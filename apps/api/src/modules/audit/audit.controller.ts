import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuditService } from './audit.service';
import { capJsonForAudit, redactSensitivePayload } from './audit.utils';

type AuditedRequest = Request & {
  userId?: string;
  tenantContext?: { tenantId?: string };
};

type ClientEventBody = {
  eventName?: string;
  page?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Post('client-events')
  async captureClientEvent(
    @Req() req: AuditedRequest,
    @Body() body: ClientEventBody,
  ): Promise<{ ok: true }> {
    const eventName = (body.eventName ?? '').trim().slice(0, 128) || 'unknown';
    const page = (body.page ?? '').trim().slice(0, 400) || null;
    const targetType = (body.targetType ?? '').trim().slice(0, 64) || null;
    const targetId = (body.targetId ?? '').trim().slice(0, 128) || null;
    const tenantHeader = req.header('x-tenant-id')?.trim();
    const tenantId = req.tenantContext?.tenantId?.trim() || tenantHeader || null;
    const userId = req.userId?.trim() || null;
    const ip =
      (req.ip || req.socket?.remoteAddress || '').toString().slice(0, 64) || null;
    const userAgent = req.get('user-agent')?.slice(0, 4000) ?? null;

    await this.auditService.record({
      method: 'CLIENT',
      path: `/client/${eventName}`,
      normalizedPath: '/client/:eventName',
      statusCode: 200,
      durationMs: 0,
      tenantId,
      userId,
      ip,
      userAgent,
      query: null,
      errorMessage: null,
      requestBody: capJsonForAudit(
        redactSensitivePayload({
          eventName,
          page,
          targetType,
          targetId,
          metadata: body.metadata ?? {},
        }),
      ) as Record<string, unknown>,
    });

    return { ok: true };
  }
}
