import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CreatePromoCodeDto } from '../dto/promo-code.dto';
import type { UpdatePromoCodeDto } from '../dto/promo-code.dto';
import { TenantPromoCode } from '../entities/tenant-promo-code.entity';

function dec(n: number): string {
  return Number(n).toFixed(2);
}

function numFromDec(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type PromoCodeApiRow = {
  id: string;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minSubTotal: number | null;
  validFrom: string | null;
  validTo: string | null;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class PromoCodesService {
  constructor(
    @InjectRepository(TenantPromoCode)
    private readonly repo: Repository<TenantPromoCode>,
  ) {}

  private toApiRow(row: TenantPromoCode): PromoCodeApiRow {
    return {
      id: row.id,
      code: row.code,
      discountType: row.discountType,
      discountValue: numFromDec(row.discountValue),
      minSubTotal:
        row.minSubTotal != null ? numFromDec(row.minSubTotal) : null,
      validFrom: row.validFrom?.toISOString() ?? null,
      validTo: row.validTo?.toISOString() ?? null,
      maxUses: row.maxUses ?? null,
      usedCount: row.usedCount,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async list(tenantId: string): Promise<PromoCodeApiRow[]> {
    const rows = await this.repo.find({
      where: { tenantId },
      order: { code: 'ASC' },
    });
    return rows.map((r) => this.toApiRow(r));
  }

  async create(
    tenantId: string,
    dto: CreatePromoCodeDto,
  ): Promise<PromoCodeApiRow> {
    const code = dto.code.trim().toUpperCase();
    if (!code) throw new BadRequestException('Promo code is required');
    if (dto.discountType === 'percent' && dto.discountValue > 100) {
      throw new BadRequestException('Percent discount cannot exceed 100');
    }
    const saved = await this.repo.save(
      this.repo.create({
        tenantId,
        code,
        discountType: dto.discountType,
        discountValue: dec(dto.discountValue),
        minSubTotal:
          dto.minSubTotal != null ? dec(dto.minSubTotal) : undefined,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
        maxUses: dto.maxUses,
        isActive: dto.isActive ?? true,
      }),
    );
    return this.toApiRow(saved);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdatePromoCodeDto,
  ): Promise<PromoCodeApiRow> {
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException(`Promo code ${id} not found`);
    if (dto.code !== undefined) row.code = dto.code.trim().toUpperCase();
    if (dto.discountType !== undefined) row.discountType = dto.discountType;
    if (dto.discountValue !== undefined) {
      if (dto.discountType === 'percent' || row.discountType === 'percent') {
        const t = dto.discountType ?? row.discountType;
        if (t === 'percent' && dto.discountValue > 100) {
          throw new BadRequestException('Percent discount cannot exceed 100');
        }
      }
      row.discountValue = dec(dto.discountValue);
    }
    if (dto.minSubTotal !== undefined) {
      row.minSubTotal =
        dto.minSubTotal == null ? null : dec(dto.minSubTotal);
    }
    if (dto.validFrom !== undefined) {
      row.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    }
    if (dto.validTo !== undefined) {
      row.validTo = dto.validTo ? new Date(dto.validTo) : null;
    }
    if (dto.maxUses !== undefined) row.maxUses = dto.maxUses;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    const saved = await this.repo.save(row);
    return this.toApiRow(saved);
  }

  async remove(
    tenantId: string,
    id: string,
  ): Promise<{ deleted: true; id: string }> {
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException(`Promo code ${id} not found`);
    await this.repo.remove(row);
    return { deleted: true, id };
  }

  computeDiscount(promo: TenantPromoCode, subTotal: number): number {
    const value = numFromDec(promo.discountValue);
    if (promo.discountType === 'percent') {
      return Number(((subTotal * value) / 100).toFixed(2));
    }
    return Math.min(subTotal, value);
  }

  assertPromoUsable(promo: TenantPromoCode, subTotal: number, now = new Date()) {
    if (!promo.isActive) {
      throw new BadRequestException('Promo code is not active');
    }
    if (promo.validFrom && now < promo.validFrom) {
      throw new BadRequestException('Promo code is not yet valid');
    }
    if (promo.validTo && now > promo.validTo) {
      throw new BadRequestException('Promo code has expired');
    }
    if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
      throw new BadRequestException('Promo code usage limit reached');
    }
    const minSub = promo.minSubTotal != null ? numFromDec(promo.minSubTotal) : 0;
    if (subTotal < minSub) {
      throw new BadRequestException(
        `Minimum order amount for this promo is ${minSub}`,
      );
    }
  }

  async resolveForCheckout(
    tenantId: string,
    code: string,
    subTotal: number,
  ): Promise<{ promo: TenantPromoCode; discount: number }> {
    const normalized = code.trim().toUpperCase();
    const promo = await this.repo.findOne({
      where: { tenantId, code: normalized },
    });
    if (!promo) throw new BadRequestException('Invalid promo code');
    this.assertPromoUsable(promo, subTotal);
    const discount = this.computeDiscount(promo, subTotal);
    return { promo, discount };
  }

  async validate(
    tenantId: string,
    code: string,
    subTotal: number,
  ): Promise<{
    valid: true;
    code: string;
    discountType: 'percent' | 'fixed';
    discountValue: number;
    discount: number;
    subTotal: number;
    totalAfterDiscount: number;
  }> {
    const { promo, discount } = await this.resolveForCheckout(
      tenantId,
      code,
      subTotal,
    );
    return {
      valid: true,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: numFromDec(promo.discountValue),
      discount,
      subTotal,
      totalAfterDiscount: Math.max(0, Number((subTotal - discount).toFixed(2))),
    };
  }

  async incrementUsage(promoId: string): Promise<void> {
    await this.repo.increment({ id: promoId }, 'usedCount', 1);
  }
}
