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
import { CreateCanteenItemDto } from './dto/create-canteen-item.dto';
import { UpdateCanteenItemDto } from './dto/update-canteen-item.dto';
import { CanteenItem } from './entities/canteen-item.entity';

export type CanteenItemRow = {
  id: string;
  locationId: string;
  name: string;
  category: string;
  stockQuantity: number;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  expiryDate?: string | null;
  lowStockThreshold: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class CanteenService {
  constructor(
    @InjectRepository(CanteenItem)
    private readonly items: Repository<CanteenItem>,
    @InjectRepository(BusinessLocation)
    private readonly locations: Repository<BusinessLocation>,
    @InjectRepository(BusinessMembership)
    private readonly memberships: Repository<BusinessMembership>,
    private readonly iamService: IamService,
  ) {}

  private formatDateOnly(value: Date | string): string {
    if (typeof value === 'string') {
      return value.slice(0, 10);
    }
    return value.toISOString().slice(0, 10);
  }

  private toRow(e: CanteenItem): CanteenItemRow {
    return {
      id: e.id,
      locationId: e.locationId,
      name: e.name,
      category: e.category,
      stockQuantity: e.stockQuantity,
      unit: e.unit,
      purchasePrice: Number(e.purchasePrice),
      sellingPrice: Number(e.sellingPrice),
      expiryDate: e.expiryDate ? this.formatDateOnly(e.expiryDate) : null,
      lowStockThreshold: e.lowStockThreshold,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
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

  async list(
    requesterUserId: string,
    locationId?: string,
  ): Promise<CanteenItemRow[]> {
    const lid = locationId?.trim();
    if (!lid) {
      return [];
    }
    await this.assertCanAccessLocation(requesterUserId, lid);
    const rows = await this.items.find({
      where: { locationId: lid },
      order: { name: 'ASC', createdAt: 'DESC' },
    });
    return rows.map((e) => this.toRow(e));
  }

  async create(
    requesterUserId: string,
    dto: CreateCanteenItemDto,
  ): Promise<CanteenItemRow> {
    await this.assertCanAccessLocation(requesterUserId, dto.locationId);
    const row = this.items.create({
      locationId: dto.locationId,
      name: dto.name.trim(),
      category: dto.category?.trim() || 'General',
      stockQuantity: dto.stockQuantity ?? 0,
      unit: dto.unit?.trim() || 'pcs',
      purchasePrice: String(dto.purchasePrice ?? 0),
      sellingPrice: String(dto.sellingPrice ?? 0),
      expiryDate: dto.expiryDate ? dto.expiryDate.slice(0, 10) : null,
      lowStockThreshold: dto.lowStockThreshold ?? 10,
      status: dto.status?.trim() || 'active',
    });
    const saved = await this.items.save(row);
    return this.toRow(saved);
  }

  async update(
    requesterUserId: string,
    id: string,
    dto: UpdateCanteenItemDto,
  ): Promise<CanteenItemRow> {
    const existing = await this.items.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Canteen item ${id} not found`);
    }
    await this.assertCanAccessLocation(requesterUserId, existing.locationId);
    if (dto.name !== undefined) existing.name = dto.name.trim();
    if (dto.category !== undefined) {
      existing.category = dto.category?.trim() || 'General';
    }
    if (dto.stockQuantity !== undefined) {
      existing.stockQuantity = dto.stockQuantity;
    }
    if (dto.unit !== undefined) existing.unit = dto.unit.trim() || 'pcs';
    if (dto.purchasePrice !== undefined) {
      existing.purchasePrice = String(dto.purchasePrice);
    }
    if (dto.sellingPrice !== undefined) {
      existing.sellingPrice = String(dto.sellingPrice);
    }
    if (dto.expiryDate !== undefined) {
      existing.expiryDate = dto.expiryDate
        ? dto.expiryDate.slice(0, 10)
        : null;
    }
    if (dto.lowStockThreshold !== undefined) {
      existing.lowStockThreshold = dto.lowStockThreshold;
    }
    if (dto.status !== undefined) {
      existing.status = dto.status.trim() || 'active';
    }
    const saved = await this.items.save(existing);
    return this.toRow(saved);
  }

  async remove(requesterUserId: string, id: string): Promise<void> {
    const existing = await this.items.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Canteen item ${id} not found`);
    }
    await this.assertCanAccessLocation(requesterUserId, existing.locationId);
    await this.items.delete({ id });
  }
}
