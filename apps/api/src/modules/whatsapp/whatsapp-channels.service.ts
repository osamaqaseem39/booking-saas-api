import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { resolveApiPublicBaseUrl } from '../../common/utils/api-public-url.util';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessesService } from '../businesses/businesses.service';
import { BusinessMembership } from '../businesses/entities/business-membership.entity';
import { Business } from '../businesses/entities/business.entity';
import { IamService } from '../iam/iam.service';
import {
  WhatsappChannel,
  type WhatsappChannelProvider,
  type WhatsappChannelStatus,
} from './entities/whatsapp-channel.entity';
import { OpenwaProvider } from './providers/openwa.provider';
import { WhatsappSendService } from './whatsapp-send.service';

export type WhatsappChannelRow = {
  id: string;
  tenantId: string;
  locationId: string | null;
  provider: WhatsappChannelProvider;
  phoneNumberId: string;
  displayNumber: string;
  wabaId: string;
  status: WhatsappChannelStatus;
  botEnabled: boolean;
  greetingMessage: string | null;
  defaultLocationId: string | null;
  openwaApiBaseUrl: string | null;
  lastWebhookAt: string | null;
  hasAccessToken: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WhatsappChannelConnectResult = WhatsappChannelRow & {
  openwaWebhookUrl?: string;
  webhookWarning?: string;
};

@Injectable()
export class WhatsappChannelsService {
  private readonly logger = new Logger(WhatsappChannelsService.name);

  constructor(
    @InjectRepository(WhatsappChannel)
    private readonly channels: Repository<WhatsappChannel>,
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
    @InjectRepository(BusinessMembership)
    private readonly memberships: Repository<BusinessMembership>,
    private readonly businessesService: BusinessesService,
    private readonly iamService: IamService,
    private readonly send: WhatsappSendService,
    private readonly openwa: OpenwaProvider,
  ) {}

  private toRow(channel: WhatsappChannel): WhatsappChannelRow {
    return {
      id: channel.id,
      tenantId: channel.tenantId,
      locationId: channel.locationId ?? null,
      provider: channel.provider ?? 'meta',
      phoneNumberId: channel.phoneNumberId,
      displayNumber: channel.displayNumber,
      wabaId: channel.wabaId,
      status: channel.status,
      botEnabled: channel.botEnabled,
      greetingMessage: channel.greetingMessage ?? null,
      defaultLocationId: channel.defaultLocationId ?? null,
      openwaApiBaseUrl: channel.openwaApiBaseUrl ?? null,
      lastWebhookAt: channel.lastWebhookAt?.toISOString() ?? null,
      hasAccessToken: Boolean(channel.accessToken?.trim()),
      createdAt: channel.createdAt.toISOString(),
      updatedAt: channel.updatedAt.toISOString(),
    };
  }

  private async assertCanManageTenant(
    requesterUserId: string,
    tenantId: string,
  ): Promise<void> {
    await this.iamService.assertRequesterActive(requesterUserId);
    const isPlatformOwner = await this.iamService.hasAnyRole(requesterUserId, [
      'platform-owner',
    ]);
    if (isPlatformOwner) return;
    const business = await this.businesses.findOne({ where: { tenantId } });
    if (!business) throw new NotFoundException('Business not found for tenant');
    const membership = await this.memberships.findOne({
      where: { userId: requesterUserId, businessId: business.id },
    });
    if (!membership) {
      throw new ForbiddenException('Not allowed for this business');
    }
    const isAdmin = await this.iamService.hasAnyRole(requesterUserId, [
      'business-admin',
      'location-admin',
    ]);
    if (!isAdmin) {
      throw new ForbiddenException('Only business admins can manage WhatsApp');
    }
  }

  async listForTenant(
    requesterUserId: string,
    tenantId: string,
  ): Promise<WhatsappChannelRow[]> {
    await this.assertCanManageTenant(requesterUserId, tenantId);
    const rows = await this.channels.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.toRow(r));
  }

  async connect(
    requesterUserId: string,
    tenantId: string,
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
  ): Promise<WhatsappChannelConnectResult> {
    await this.assertCanManageTenant(requesterUserId, tenantId);
    const provider = dto.provider ?? 'meta';
    const phoneNumberId = dto.phoneNumberId.trim();
    const accessToken = dto.accessToken.trim();
    if (!phoneNumberId || !accessToken) {
      throw new BadRequestException('phoneNumberId and accessToken are required');
    }
    if (provider === 'meta' && !dto.wabaId?.trim()) {
      throw new BadRequestException('wabaId is required for Meta Cloud API channels');
    }
    if (!dto.locationId?.trim() && !dto.defaultLocationId?.trim()) {
      throw new BadRequestException(
        'locationId is required so the bot can load courts and create bookings',
      );
    }
    if (dto.locationId) {
      await this.businessesService.assertLocationBelongsToTenant(
        dto.locationId,
        tenantId,
      );
    }
    if (dto.defaultLocationId) {
      await this.businessesService.assertLocationBelongsToTenant(
        dto.defaultLocationId,
        tenantId,
      );
    }
    const existing = await this.channels.findOne({ where: { phoneNumberId } });
    if (existing && existing.tenantId !== tenantId) {
      throw new BadRequestException('This WhatsApp number is already linked to another business');
    }
    const payload = {
      tenantId,
      locationId: dto.locationId ?? null,
      provider,
      phoneNumberId,
      displayNumber: dto.displayNumber.trim(),
      wabaId: dto.wabaId?.trim() || 'openwa',
      accessToken,
      status: 'connected' as const,
      botEnabled: dto.botEnabled ?? true,
      greetingMessage: dto.greetingMessage?.trim() || null,
      defaultLocationId: dto.defaultLocationId ?? dto.locationId ?? null,
      openwaApiBaseUrl:
        provider === 'openwa' ? dto.openwaApiBaseUrl?.trim() || null : null,
    };
    const saved = existing
      ? await this.channels.save({ ...existing, ...payload })
      : await this.channels.save(this.channels.create(payload));

    let openwaWebhookUrl: string | undefined;
    let webhookWarning: string | undefined;
    if (provider === 'openwa' && dto.registerWebhook !== false) {
      try {
        openwaWebhookUrl = this.resolvePublicWebhookUrl('/webhooks/openwa');
        await this.registerOpenWaWebhook(saved);
      } catch (e) {
        webhookWarning = e instanceof Error ? e.message : String(e);
        this.logger.warn(`OpenWA webhook registration failed: ${webhookWarning}`);
      }
    }

    return {
      ...this.toRow(saved),
      ...(openwaWebhookUrl ? { openwaWebhookUrl } : {}),
      ...(webhookWarning ? { webhookWarning } : {}),
    };
  }

  private resolvePublicWebhookUrl(path: string): string {
    const base = resolveApiPublicBaseUrl();
    if (!base) {
      throw new BadRequestException(
        'Set API_PUBLIC_URL (or deploy on Vercel so VERCEL_URL is set) to register OpenWA webhooks',
      );
    }
    return `${base}${path}`;
  }

  async registerOpenWaWebhook(channel: WhatsappChannel): Promise<void> {
    const secret = process.env.OPENWA_WEBHOOK_SECRET?.trim();
    if (!secret) {
      throw new BadRequestException('OPENWA_WEBHOOK_SECRET is not configured');
    }
    const url = this.resolvePublicWebhookUrl('/webhooks/openwa');
    await this.openwa.registerWebhook({
      sessionId: channel.phoneNumberId,
      accessToken: channel.accessToken,
      apiBaseUrl: channel.openwaApiBaseUrl,
      url,
      secret,
    });
  }

  async registerOpenWaWebhookForChannel(
    requesterUserId: string,
    tenantId: string,
    channelId: string,
  ): Promise<{ ok: true; webhookUrl: string }> {
    await this.assertCanManageTenant(requesterUserId, tenantId);
    const channel = await this.channels.findOne({
      where: { id: channelId, tenantId },
    });
    if (!channel) throw new NotFoundException('WhatsApp channel not found');
    if ((channel.provider ?? 'meta') !== 'openwa') {
      throw new BadRequestException('Channel is not an OpenWA session');
    }
    await this.registerOpenWaWebhook(channel);
    return { ok: true, webhookUrl: this.resolvePublicWebhookUrl('/webhooks/openwa') };
  }

  async update(
    requesterUserId: string,
    tenantId: string,
    channelId: string,
    dto: {
      botEnabled?: boolean;
      greetingMessage?: string | null;
      locationId?: string | null;
      defaultLocationId?: string | null;
      openwaApiBaseUrl?: string | null;
      status?: WhatsappChannelStatus;
      accessToken?: string;
    },
  ): Promise<WhatsappChannelRow> {
    await this.assertCanManageTenant(requesterUserId, tenantId);
    const channel = await this.channels.findOne({
      where: { id: channelId, tenantId },
    });
    if (!channel) throw new NotFoundException('WhatsApp channel not found');
    if (dto.locationId) {
      await this.businessesService.assertLocationBelongsToTenant(
        dto.locationId,
        tenantId,
      );
    }
    if (dto.defaultLocationId) {
      await this.businessesService.assertLocationBelongsToTenant(
        dto.defaultLocationId,
        tenantId,
      );
    }
    if (dto.botEnabled !== undefined) channel.botEnabled = dto.botEnabled;
    if (dto.greetingMessage !== undefined) {
      channel.greetingMessage = dto.greetingMessage?.trim() || null;
    }
    if (dto.locationId !== undefined) {
      channel.locationId = dto.locationId;
      if (dto.defaultLocationId === undefined && dto.locationId) {
        channel.defaultLocationId = dto.locationId;
      }
    }
    if (dto.defaultLocationId !== undefined) {
      channel.defaultLocationId = dto.defaultLocationId;
    }
    if (dto.openwaApiBaseUrl !== undefined) {
      channel.openwaApiBaseUrl = dto.openwaApiBaseUrl?.trim() || null;
    }
    if (dto.status !== undefined) channel.status = dto.status;
    if (dto.accessToken?.trim()) channel.accessToken = dto.accessToken.trim();
    return this.toRow(await this.channels.save(channel));
  }

  async disconnect(
    requesterUserId: string,
    tenantId: string,
    channelId: string,
  ): Promise<WhatsappChannelRow> {
    await this.assertCanManageTenant(requesterUserId, tenantId);
    const channel = await this.channels.findOne({
      where: { id: channelId, tenantId },
    });
    if (!channel) throw new NotFoundException('WhatsApp channel not found');
    channel.status = 'disconnected';
    channel.botEnabled = false;
    channel.accessToken = '';
    return this.toRow(await this.channels.save(channel));
  }

  async findByPhoneNumberId(phoneNumberId: string): Promise<WhatsappChannel | null> {
    return this.channels.findOne({
      where: { phoneNumberId, status: 'connected', provider: 'meta' },
    });
  }

  async findByOpenWaSessionId(sessionId: string): Promise<WhatsappChannel | null> {
    return this.channels.findOne({
      where: { phoneNumberId: sessionId, status: 'connected', provider: 'openwa' },
    });
  }

  async touchWebhook(channelId: string): Promise<void> {
    await this.channels.update(channelId, { lastWebhookAt: new Date() });
  }

  async sendTestMessage(
    requesterUserId: string,
    tenantId: string,
    channelId: string,
    toWaId: string,
  ): Promise<{ ok: true }> {
    await this.assertCanManageTenant(requesterUserId, tenantId);
    const channel = await this.channels.findOne({
      where: { id: channelId, tenantId, status: 'connected' },
    });
    if (!channel?.accessToken?.trim()) {
      throw new BadRequestException('Channel is not connected');
    }
    const digits = toWaId.replace(/\D/g, '');
    if (digits.length < 10) {
      throw new BadRequestException('toWaId must be a WhatsApp phone number');
    }
    if ((channel.provider ?? 'meta') === 'openwa') {
      this.assertOpenWaReachable(channel);
    }
    try {
      await this.send.sendForChannel(
        channel,
        digits,
        'Velay WhatsApp test — your number is connected.',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'WhatsApp send failed';
      throw new BadRequestException(msg);
    }
    return { ok: true };
  }

  private assertOpenWaReachable(channel: WhatsappChannel): void {
    const base =
      channel.openwaApiBaseUrl?.trim() ||
      process.env.OPENWA_BASE_URL?.trim() ||
      'http://localhost:2785';
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(base);
    if (isLocal && resolveApiPublicBaseUrl()) {
      throw new BadRequestException(
        'Production API cannot reach local OpenWA. Set a public OpenWA URL on this channel (ngrok/cloudflared), or call test from a local API.',
      );
    }
  }
}
