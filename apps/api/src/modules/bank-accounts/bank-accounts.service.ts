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
import { BankAccount } from './entities/bank-account.entity';

export type BankAccountRow = {
  id: string;
  locationId: string;
  title: string;
  bankName: string;
  accountNumber: string;
  accountHolder?: string;
  isDefault: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class BankAccountsService {
  constructor(
    @InjectRepository(BankAccount)
    private readonly accounts: Repository<BankAccount>,
    @InjectRepository(BusinessLocation)
    private readonly locations: Repository<BusinessLocation>,
    @InjectRepository(BusinessMembership)
    private readonly memberships: Repository<BusinessMembership>,
    private readonly iamService: IamService,
  ) {}

  private toRow(e: BankAccount): BankAccountRow {
    return {
      id: e.id,
      locationId: e.locationId,
      title: e.title,
      bankName: e.bankName,
      accountNumber: e.accountNumber,
      accountHolder: e.accountHolder,
      isDefault: e.isDefault,
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
    if (!loc) throw new NotFoundException(`Location ${locationId} not found`);
    const isPlatformOwner = await this.iamService.hasAnyRole(requesterUserId, [
      'platform-owner',
    ]);
    if (isPlatformOwner) return loc;
    const constraint =
      await this.iamService.getLocationAdminConstraint(requesterUserId);
    if (constraint) {
      if (constraint !== locationId)
        throw new ForbiddenException('Not allowed for this location');
      return loc;
    }
    const m = await this.memberships.findOne({
      where: { userId: requesterUserId, businessId: loc.businessId },
    });
    if (!m) throw new ForbiddenException('Not allowed for this location');
    return loc;
  }

  async list(
    requesterUserId: string,
    locationId?: string,
  ): Promise<BankAccountRow[]> {
    const lid = locationId?.trim();
    if (!lid) return [];
    await this.assertCanAccessLocation(requesterUserId, lid);
    const rows = await this.accounts.find({
      where: { locationId: lid },
      order: { isDefault: 'DESC', title: 'ASC' },
    });
    return rows.map((e) => this.toRow(e));
  }

  async create(
    requesterUserId: string,
    dto: {
      locationId: string;
      title: string;
      bankName: string;
      accountNumber: string;
      accountHolder?: string;
      isDefault?: boolean;
    },
  ): Promise<BankAccountRow> {
    await this.assertCanAccessLocation(requesterUserId, dto.locationId);
    if (dto.isDefault) {
      await this.accounts.update(
        { locationId: dto.locationId },
        { isDefault: false },
      );
    }
    const row = this.accounts.create({
      locationId: dto.locationId,
      title: dto.title.trim(),
      bankName: dto.bankName.trim(),
      accountNumber: dto.accountNumber.trim(),
      accountHolder: dto.accountHolder?.trim(),
      isDefault: dto.isDefault ?? false,
      status: 'active',
    });
    const saved = await this.accounts.save(row);
    return this.toRow(saved);
  }

  async update(
    requesterUserId: string,
    id: string,
    dto: {
      title?: string;
      bankName?: string;
      accountNumber?: string;
      accountHolder?: string;
      isDefault?: boolean;
      status?: string;
    },
  ): Promise<BankAccountRow> {
    const existing = await this.accounts.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Bank account ${id} not found`);
    await this.assertCanAccessLocation(requesterUserId, existing.locationId);
    if (dto.title !== undefined) existing.title = dto.title.trim();
    if (dto.bankName !== undefined) existing.bankName = dto.bankName.trim();
    if (dto.accountNumber !== undefined)
      existing.accountNumber = dto.accountNumber.trim();
    if (dto.accountHolder !== undefined)
      existing.accountHolder = dto.accountHolder?.trim();
    if (dto.isDefault !== undefined) {
      if (dto.isDefault) {
        await this.accounts.update(
          { locationId: existing.locationId },
          { isDefault: false },
        );
      }
      existing.isDefault = dto.isDefault;
    }
    if (dto.status !== undefined) existing.status = dto.status.trim();
    const saved = await this.accounts.save(existing);
    return this.toRow(saved);
  }

  async remove(requesterUserId: string, id: string): Promise<void> {
    const existing = await this.accounts.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Bank account ${id} not found`);
    await this.assertCanAccessLocation(requesterUserId, existing.locationId);
    await this.accounts.delete({ id });
  }
}
