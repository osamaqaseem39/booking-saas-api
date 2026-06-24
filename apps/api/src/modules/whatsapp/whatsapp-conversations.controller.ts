import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CurrentTenant } from '../../tenancy/tenant-context.decorator';
import type { TenantContext } from '../../tenancy/tenant-context.interface';
import { Roles } from '../iam/authz/roles.decorator';
import { RolesGuard } from '../iam/authz/roles.guard';
import { WhatsappChannel } from './entities/whatsapp-channel.entity';
import { WhatsappConversation } from './entities/whatsapp-conversation.entity';
import { WhatsappMessagesService } from './whatsapp-messages.service';
import { IamService } from '../iam/iam.service';

function assertWorkerKey(key?: string): void {
  const expected = process.env.OPENWA_WORKER_KEY?.trim();
  if (!expected || key?.trim() !== expected) {
    throw new ForbiddenException('Invalid worker key');
  }
}

@Controller('whatsapp')
export class WhatsappConversationsController {
  constructor(
    private readonly messages: WhatsappMessagesService,
    private readonly iam: IamService,
    @InjectRepository(WhatsappConversation)
    private readonly convRepo: Repository<WhatsappConversation>,
    @InjectRepository(WhatsappChannel)
    private readonly channelRepo: Repository<WhatsappChannel>,
  ) {}

  private uid(req: Request): string {
    const id = (req as Request & { userId?: string }).userId?.trim();
    if (!id) throw new ForbiddenException('Missing user');
    return id;
  }

  private async scopedChannelIds(tenantId: string, userId: string): Promise<string[] | null> {
    const scopeLocationId = await this.iam.getLocationAdminConstraint(userId);
    if (!scopeLocationId) return null;
    const channels = await this.channelRepo.find({ where: { tenantId } });
    return channels
      .filter(
        (c) =>
          (c.locationId ?? c.defaultLocationId ?? null) === scopeLocationId,
      )
      .map((c) => c.id);
  }

  @Get('conversations')
  @UseGuards(RolesGuard)
  @Roles('platform-owner', 'business-admin', 'location-admin')
  async listConversations(
    @Req() req: Request,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const tenantId = tenant.tenantId?.trim();
    if (!tenantId) throw new ForbiddenException('Missing tenant');
    const userId = this.uid(req);
    const channelIds = await this.scopedChannelIds(tenantId, userId);
    if (channelIds !== null && channelIds.length === 0) return [];
    const rows = await this.convRepo.find({
      where:
        channelIds !== null
          ? { tenantId, channelId: In(channelIds) }
          : { tenantId },
      order: { lastMessageAt: 'DESC' },
      take: 50,
    });
    return rows.map((c) => ({
      id: c.id,
      channelId: c.channelId,
      customerWaId: c.customerWaId,
      step: c.step,
      lastMessageAt: c.lastMessageAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  @Get('conversations/:id/messages')
  @UseGuards(RolesGuard)
  @Roles('platform-owner', 'business-admin', 'location-admin')
  async listMessages(
    @Req() req: Request,
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const tenantId = tenant.tenantId?.trim();
    if (!tenantId) throw new ForbiddenException('Missing tenant');
    const userId = this.uid(req);
    const conv = await this.convRepo.findOne({ where: { id, tenantId } });
    if (!conv) throw new NotFoundException('Conversation not found');
    const channelIds = await this.scopedChannelIds(tenantId, userId);
    if (channelIds && !channelIds.includes(conv.channelId)) {
      throw new NotFoundException('Conversation not found');
    }
    const rows = await this.messages.listForConversation(id);
    return rows.map((m) => this.messages.toRow(m));
  }

  @Get('worker/outbound-pending')
  async listPending(@Headers('x-openwa-worker-key') workerKey?: string) {
    assertWorkerKey(workerKey);
    const pending = await this.messages.listPendingOutbound(30);
    const out: Array<{
      message: ReturnType<WhatsappMessagesService['toRow']>;
      channel: {
        phoneNumberId: string;
        accessToken: string;
        openwaApiBaseUrl?: string | null;
      };
    }> = [];
    for (const m of pending) {
      const channel = await this.channelRepo.findOne({
        where: { id: m.channelId, status: 'connected' },
      });
      if (!channel || (channel.provider ?? 'meta') !== 'openwa') continue;
      out.push({
        message: this.messages.toRow(m),
        channel: {
          phoneNumberId: channel.phoneNumberId,
          accessToken: channel.accessToken,
          openwaApiBaseUrl: channel.openwaApiBaseUrl,
        },
      });
    }
    return { items: out };
  }

  @Post('worker/messages/:id/sent')
  async markSent(
    @Headers('x-openwa-worker-key') workerKey: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertWorkerKey(workerKey);
    await this.messages.markSent(id);
    return { ok: true };
  }

  @Post('worker/messages/:id/failed')
  async markFailed(
    @Headers('x-openwa-worker-key') workerKey: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { error?: string },
  ) {
    assertWorkerKey(workerKey);
    await this.messages.markFailed(id, body.error ?? 'send failed');
    return { ok: true };
  }
}
