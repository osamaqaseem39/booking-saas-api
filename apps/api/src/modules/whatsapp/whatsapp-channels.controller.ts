import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentTenant } from '../../tenancy/tenant-context.decorator';
import { TenantContext } from '../../tenancy/tenant-context.interface';
import { Roles } from '../iam/authz/roles.decorator';
import { RolesGuard } from '../iam/authz/roles.guard';
import { WhatsappChannelsService } from './whatsapp-channels.service';
import type { WhatsappChannelStatus, WhatsappChannelProvider } from './entities/whatsapp-channel.entity';

@Controller('whatsapp/channels')
@UseGuards(RolesGuard)
export class WhatsappChannelsController {
  constructor(private readonly service: WhatsappChannelsService) {}

  private uid(req: Request): string {
    const id = (req as Request & { userId?: string }).userId?.trim();
    if (!id) throw new UnauthorizedException('Missing user');
    return id;
  }

  private tenantId(tenant: TenantContext): string {
    const id = tenant.tenantId?.trim();
    if (!id) {
      throw new BadRequestException(
        'Set an active business tenant (X-Tenant-Id) to manage WhatsApp.',
      );
    }
    return id;
  }

  @Get()
  @Roles('platform-owner', 'business-admin', 'location-admin')
  list(@Req() req: Request, @CurrentTenant() tenant: TenantContext) {
    return this.service.listForTenant(this.uid(req), this.tenantId(tenant));
  }

  @Post()
  @Roles('platform-owner', 'business-admin', 'location-admin')
  connect(
    @Req() req: Request,
    @CurrentTenant() tenant: TenantContext,
    @Body()
    dto: {
      provider?: WhatsappChannelProvider;
      locationId?: string;
      phoneNumberId: string;
      displayNumber: string;
      wabaId?: string;
      accessToken: string;
      greetingMessage?: string;
      defaultLocationId?: string;
      openwaApiBaseUrl?: string;
      botEnabled?: boolean;
      registerWebhook?: boolean;
    },
  ) {
    return this.service.connect(this.uid(req), this.tenantId(tenant), dto);
  }

  @Patch(':id')
  @Roles('platform-owner', 'business-admin', 'location-admin')
  update(
    @Req() req: Request,
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: {
      botEnabled?: boolean;
      greetingMessage?: string | null;
      locationId?: string | null;
      defaultLocationId?: string | null;
      openwaApiBaseUrl?: string | null;
      status?: WhatsappChannelStatus;
      accessToken?: string;
    },
  ) {
    return this.service.update(this.uid(req), this.tenantId(tenant), id, dto);
  }

  @Delete(':id')
  @Roles('platform-owner', 'business-admin', 'location-admin')
  disconnect(
    @Req() req: Request,
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.disconnect(this.uid(req), this.tenantId(tenant), id);
  }

  @Post(':id/test')
  @Roles('platform-owner', 'business-admin', 'location-admin')
  test(
    @Req() req: Request,
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { toWaId: string },
  ) {
    return this.service.sendTestMessage(
      this.uid(req),
      this.tenantId(tenant),
      id,
      dto.toWaId,
    );
  }

  @Post(':id/openwa/register-webhook')
  @Roles('platform-owner', 'business-admin', 'location-admin')
  registerOpenWaWebhook(
    @Req() req: Request,
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.registerOpenWaWebhookForChannel(
      this.uid(req),
      this.tenantId(tenant),
      id,
    );
  }
}
