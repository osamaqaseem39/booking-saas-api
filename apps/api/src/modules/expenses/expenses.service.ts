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
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { Expense } from './entities/expense.entity';

export type ExpenseRow = {
  id: string;
  locationId: string;
  title: string;
  description?: string | null;
  amount: number;
  date: string;
  category: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenses: Repository<Expense>,
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

  private toRow(e: Expense): ExpenseRow {
    return {
      id: e.id,
      locationId: e.locationId,
      title: e.title,
      description: e.description ?? null,
      amount: Number(e.amount),
      date: this.formatDateOnly(e.date),
      category: e.category,
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
  ): Promise<ExpenseRow[]> {
    const lid = locationId?.trim();
    if (!lid) {
      return [];
    }
    await this.assertCanAccessLocation(requesterUserId, lid);
    const rows = await this.expenses.find({
      where: { locationId: lid },
      order: { date: 'DESC', createdAt: 'DESC' },
    });
    return rows.map((e) => this.toRow(e));
  }

  async create(
    requesterUserId: string,
    dto: CreateExpenseDto,
  ): Promise<ExpenseRow> {
    await this.assertCanAccessLocation(requesterUserId, dto.locationId);
    const row = this.expenses.create({
      locationId: dto.locationId,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      amount: String(dto.amount),
      date: dto.date.slice(0, 10),
      category: dto.category.trim(),
    });
    const saved = await this.expenses.save(row);
    return this.toRow(saved);
  }

  async update(
    requesterUserId: string,
    id: string,
    dto: UpdateExpenseDto,
  ): Promise<ExpenseRow> {
    const existing = await this.expenses.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Expense ${id} not found`);
    }
    await this.assertCanAccessLocation(requesterUserId, existing.locationId);
    if (dto.title !== undefined) existing.title = dto.title.trim();
    if (dto.description !== undefined) {
      existing.description = dto.description?.trim() || null;
    }
    if (dto.amount !== undefined) existing.amount = String(dto.amount);
    if (dto.date !== undefined) existing.date = dto.date.slice(0, 10);
    if (dto.category !== undefined) existing.category = dto.category.trim();
    const saved = await this.expenses.save(existing);
    return this.toRow(saved);
  }

  async remove(requesterUserId: string, id: string): Promise<void> {
    const existing = await this.expenses.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Expense ${id} not found`);
    }
    await this.assertCanAccessLocation(requesterUserId, existing.locationId);
    await this.expenses.delete({ id });
  }
}
