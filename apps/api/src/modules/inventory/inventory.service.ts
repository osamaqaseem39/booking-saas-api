import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { BusinessMembership } from '../businesses/entities/business-membership.entity';
import { IamService } from '../iam/iam.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { Asset } from './entities/asset.entity';

export type AssetRow = {
  id: string;
  locationId: string;
  name: string;
  description?: string | null;
  type: string;
  totalQuantity: number;
  availableQuantity: number;
  status: string;
  rentalPrice?: number | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Asset)
    private readonly assets: Repository<Asset>,
    @InjectRepository(BusinessLocation)
    private readonly locations: Repository<BusinessLocation>,
    @InjectRepository(BusinessMembership)
    private readonly memberships: Repository<BusinessMembership>,
    private readonly iamService: IamService,
  ) {}

  private toRow(a: Asset): AssetRow {
    const rp = a.rentalPrice;
    return {
      id: a.id,
      locationId: a.locationId,
      name: a.name,
      description: a.description ?? null,
      type: a.type,
      totalQuantity: a.totalQuantity,
      availableQuantity: a.availableQuantity,
      status: a.status,
      rentalPrice:
        rp == null || rp === '' ? null : Number(rp),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }

  private async assertCanAccessLocation(
    requesterUserId: string,
    locationId: string,
  ): Promise<BusinessLocation> {
    await this.iamService.assertRequesterActive(requesterUserId);
    const loc = await this.locations.findOne({ where: { id: locationId } });
    if (!loc) {
      throw new NotFoundException(`Location ${locationId} not found`);
    }
    const isPlatformOwner = await this.iamService.hasAnyRole(
      requesterUserId,
      ['platform-owner'],
    );
    if (isPlatformOwner) {
      return loc;
    }
    const constraint =
      await this.iamService.getLocationAdminConstraint(requesterUserId);
    if (constraint) {
      if (constraint !== locationId) {
        throw new ForbiddenException('Not allowed for this location');
      }
      return loc;
    }
    const m = await this.memberships.findOne({
      where: { userId: requesterUserId, businessId: loc.businessId },
    });
    if (!m) {
      throw new ForbiddenException('Not allowed for this location');
    }
    return loc;
  }

  async list(requesterUserId: string, locationId?: string): Promise<AssetRow[]> {
    const lid = locationId?.trim();
    if (!lid) {
      return [];
    }
    await this.assertCanAccessLocation(requesterUserId, lid);
    const rows = await this.assets.find({
      where: { locationId: lid },
      order: { createdAt: 'DESC' },
    });
    return rows.map((a) => this.toRow(a));
  }

  async create(
    requesterUserId: string,
    dto: CreateAssetDto,
  ): Promise<AssetRow> {
    await this.assertCanAccessLocation(requesterUserId, dto.locationId);
    const row = this.assets.create({
      locationId: dto.locationId,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      type: dto.type.trim(),
      totalQuantity: dto.totalQuantity,
      availableQuantity: dto.availableQuantity,
      status: (dto.status ?? 'available').trim(),
      rentalPrice:
        dto.rentalPrice == null ? null : String(dto.rentalPrice),
    });
    const saved = await this.assets.save(row);
    return this.toRow(saved);
  }

  async update(
    requesterUserId: string,
    id: string,
    dto: UpdateAssetDto,
  ): Promise<AssetRow> {
    const existing = await this.assets.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Asset ${id} not found`);
    }
    await this.assertCanAccessLocation(requesterUserId, existing.locationId);
    if (dto.name !== undefined) existing.name = dto.name.trim();
    if (dto.description !== undefined) {
      existing.description = dto.description?.trim() || null;
    }
    if (dto.type !== undefined) existing.type = dto.type.trim();
    if (dto.totalQuantity !== undefined) {
      existing.totalQuantity = dto.totalQuantity;
    }
    if (dto.availableQuantity !== undefined) {
      existing.availableQuantity = dto.availableQuantity;
    }
    if (dto.status !== undefined) existing.status = dto.status.trim();
    if (dto.rentalPrice !== undefined) {
      existing.rentalPrice =
        dto.rentalPrice == null ? null : String(dto.rentalPrice);
    }
    const saved = await this.assets.save(existing);
    return this.toRow(saved);
  }

  async remove(requesterUserId: string, id: string): Promise<void> {
    const existing = await this.assets.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Asset ${id} not found`);
    }
    await this.assertCanAccessLocation(requesterUserId, existing.locationId);
    await this.assets.delete({ id });
  }
}
