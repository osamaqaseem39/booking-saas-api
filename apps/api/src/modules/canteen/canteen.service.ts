import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { BusinessMembership } from '../businesses/entities/business-membership.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { IamService } from '../iam/iam.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CreateCanteenItemDto } from './dto/create-canteen-item.dto';
import { UpdateCanteenItemDto } from './dto/update-canteen-item.dto';
import { CanteenItem } from './entities/canteen-item.entity';
import { CanteenOrder } from './entities/canteen-order.entity';
import { CanteenOrderItem } from './entities/canteen-order-item.entity';

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
    @InjectRepository(CanteenOrder)
    private readonly orders: Repository<CanteenOrder>,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(BusinessLocation)
    private readonly locations: Repository<BusinessLocation>,
    @InjectRepository(BusinessMembership)
    private readonly memberships: Repository<BusinessMembership>,
    private readonly iamService: IamService,
    @Optional() private readonly analytics?: AnalyticsService,
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

  async getPublicMenu(locationId: string) {
    const lid = locationId?.trim();
    if (!lid) throw new BadRequestException('locationId is required');
    const loc = await this.locations.findOne({ where: { id: lid } });
    if (!loc) throw new NotFoundException(`Location ${lid} not found`);

    const rows = await this.items.find({
      where: { locationId: lid, status: 'active' },
      order: { category: 'ASC', name: 'ASC' },
    });

    const categoryMap = new Map<string, typeof rows>();
    for (const item of rows) {
      const cat = item.category || 'General';
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push(item);
    }

    return {
      locationId: lid,
      categories: [...categoryMap.entries()].map(([name, items]) => ({
        name,
        items: items.map((i) => ({
          id: i.id,
          name: i.name,
          category: i.category,
          sellingPrice: Number(i.sellingPrice),
          currency: 'PKR',
          unit: i.unit,
          inStock: i.stockQuantity > 0,
          stockQuantity: i.stockQuantity,
          imageUrl: null,
        })),
      })),
    };
  }

  async createOrder(
    userId: string,
    dto: {
      locationId: string;
      bookingId?: string;
      pickupAt?: string;
      notes?: string;
      items: { itemId: string; quantity: number }[];
      payment?: { method?: string };
    },
    idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const existing = await this.orders.findOne({ where: { idempotencyKey } });
      if (existing) return this.formatOrder(existing);
    }

    const lid = dto.locationId.trim();
    const loc = await this.locations.findOne({ where: { id: lid } });
    if (!loc) throw new NotFoundException(`Location ${lid} not found`);

    if (dto.bookingId) {
      const booking = await this.bookings.findOne({
        where: { id: dto.bookingId, userId },
      });
      if (!booking) throw new ForbiddenException('Booking not found or not yours');
    }

    const lineItems: CanteenOrderItem[] = [];
    let subTotal = 0;
    for (const line of dto.items) {
      const item = await this.items.findOne({
        where: { id: line.itemId, locationId: lid, status: 'active' },
      });
      if (!item || item.stockQuantity < line.quantity) {
        throw new BadRequestException(`Item ${line.itemId} unavailable`);
      }
      const unitPrice = Number(item.sellingPrice);
      const lineTotal = unitPrice * line.quantity;
      subTotal += lineTotal;
      lineItems.push(
        this.orders.manager.create(CanteenOrderItem, {
          itemId: item.id,
          name: item.name,
          quantity: line.quantity,
          unitPrice: String(unitPrice),
          lineTotal: String(lineTotal),
        }),
      );
    }

    const order = await this.orders.save({
      locationId: lid,
      userId,
      bookingId: dto.bookingId ?? null,
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: dto.payment?.method ?? 'pay_at_venue',
      subTotal: String(subTotal),
      tax: '0',
      totalAmount: String(subTotal),
      currency: 'PKR',
      pickupAt: dto.pickupAt ? new Date(dto.pickupAt) : null,
      notes: dto.notes ?? null,
      idempotencyKey: idempotencyKey ?? null,
      items: lineItems,
    });

    for (const line of dto.items) {
      await this.items.decrement({ id: line.itemId }, 'stockQuantity', line.quantity);
    }

    const saved = await this.orders.findOne({
      where: { id: order.id },
      relations: ['items'],
    });

    this.analytics?.emitServerEvent({
      eventName: 'canteen_order_created_server',
      locationId: lid,
      userId,
      properties: {
        order_id: saved!.id,
        venue_id: lid,
        ...(dto.bookingId ? { booking_id: dto.bookingId } : {}),
        value: Number(saved!.totalAmount),
        currency: saved!.currency ?? 'PKR',
      },
    });

    return this.formatOrder(saved!);
  }

  async listOrders(userId: string, page = 1, limit = 20) {
    const take = Math.min(50, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * take;
    const [rows, total] = await this.orders.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    const locIds = [...new Set(rows.map((r) => r.locationId))];
    const locs =
      locIds.length > 0
        ? await this.locations.find({ where: { id: In(locIds) } })
        : [];
    const locNames = new Map(locs.map((l) => [l.id, l.name]));

    return {
      items: rows.map((o) => ({
        orderId: o.id,
        locationId: o.locationId,
        locationName: locNames.get(o.locationId) ?? null,
        status: o.status,
        paymentStatus: o.paymentStatus,
        totalAmount: Number(o.totalAmount),
        currency: o.currency,
        pickupAt: o.pickupAt?.toISOString() ?? null,
        createdAt: o.createdAt.toISOString(),
      })),
      page: Math.max(1, page),
      limit: take,
      total,
    };
  }

  async getOrder(userId: string, orderId: string) {
    const order = await this.orders.findOne({
      where: { id: orderId, userId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.formatOrder(order);
  }

  private formatOrder(order: CanteenOrder) {
    return {
      orderId: order.id,
      locationId: order.locationId,
      bookingId: order.bookingId ?? null,
      status: order.status,
      paymentStatus: order.paymentStatus,
      items: (order.items ?? []).map((i) => ({
        itemId: i.itemId,
        name: i.name,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
      })),
      pricing: {
        subTotal: Number(order.subTotal),
        tax: Number(order.tax),
        totalAmount: Number(order.totalAmount),
        currency: order.currency,
      },
      pickupAt: order.pickupAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
    };
  }
}
