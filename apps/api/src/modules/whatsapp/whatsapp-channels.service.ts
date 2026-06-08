import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessesService } from '../businesses/businesses.service';
import { BusinessMembership } from '../businesses/entities/business-membership.entity';
import { Business } from '../businesses/entities/business.entity';
import { IamService } from '../iam/iam.service';
import {
  WhatsappChannel,
  type WhatsappChannelStatus,
} from './entities/whatsapp-channel.entity';
import { WhatsappSendService } from './whatsapp-send.service';

export type WhatsappChannelRow = {
  id: string;
  tenantId: string;
  locationId: string | null;
  phoneNumberId: string;
  displayNumber: string;
  wabaId: string;
  status: WhatsappChannelStatus;
  botEnabled: boolean;
  greetingMessage: string | null;
  defaultLocationId: string | null;
  lastWebhookAt: string | null;
  hasAccessToken: boolean;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class WhatsappChannelsService {
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
  ) {}

  private toRow(channel: WhatsappChannel): WhatsappChannelRow {
    return {
      id: channel.id,
      tenantId: channel.tenantId,
      locationId: channel.locationId ?? null,
      phoneNumberId: channel.phoneNumberId,
      displayNumber: channel.displayNumber,
      wabaId: channel.wabaId,
      status: channel.status,
      botEnabled: channel.botEnabled,
      greetingMessage: channel.greetingMessage ?? null,
      defaultLocationId: channel.defaultLocationId ?? null,
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
      locationId?: string;
      phoneNumberId: string;
      displayNumber: string;
      wabaId: string;
      accessToken: string;
      greetingMessage?: string;
      defaultLocationId?: string;
      botEnabled?: boolean;
    },
  ): Promise<WhatsappChannelRow> {
    await this.assertCanManageTenant(requesterUserId, tenantId);
    const phoneNumberId = dto.phoneNumberId.trim();
    const accessToken = dto.accessToken.trim();
    if (!phoneNumberId || !accessToken) {
      throw new BadRequestException('phoneNumberId and accessToken are required');
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
      phoneNumberId,
      displayNumber: dto.displayNumber.trim(),
      wabaId: dto.wabaId.trim(),
      accessToken,
      status: 'connected' as const,
      botEnabled: dto.botEnabled ?? true,
      greetingMessage: dto.greetingMessage?.trim() || null,
      defaultLocationId: dto.defaultLocationId ?? dto.locationId ?? null,
    };
    const saved = existing
      ? await this.channels.save({ ...existing, ...payload })
      : await this.channels.save(this.channels.create(payload));
    return this.toRow(saved);
  }

  async update(
    requesterUserId: string,
    tenantId: string,
    channelId: string,
    dto: {
      botEnabled?: boolean;
      greetingMessage?: string | null;
      defaultLocationId?: string | null;
      status?: WhatsappChannelStatus;
      accessToken?: string;
    },
  ): Promise<WhatsappChannelRow> {
    await this.assertCanManageTenant(requesterUserId, tenantId);
    const channel = await this.channels.findOne({
      where: { id: channelId, tenantId },
    });
    if (!channel) throw new NotFoundException('WhatsApp channel not found');
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
    if (dto.defaultLocationId !== undefined) {
      channel.defaultLocationId = dto.defaultLocationId;
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
      where: { phoneNumberId, status: 'connected' },
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
    await this.send.sendText({
      phoneNumberId: channel.phoneNumberId,
      accessToken: channel.accessToken,
      toWaId: digits,
      body: 'Velay WhatsApp test — your number is connected.',
    });
    return { ok: true };
  }
}
