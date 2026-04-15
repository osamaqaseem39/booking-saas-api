import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TurfCourt } from './entities/turf-court.entity';
import type { TurfSportType } from './turf.types';

@Injectable()
export class TurfService {
  constructor(
    @InjectRepository(TurfCourt)
    private readonly turfRepo: Repository<TurfCourt>,
  ) {}

  async listBySport(
    sportType: TurfSportType,
    branchId?: string,
  ): Promise<TurfCourt[]> {
    const qb = this.turfRepo
      .createQueryBuilder('t')
      .where(':sportType = ANY(t."supportedSports")', { sportType })
      .andWhere('t.status = :status', { status: 'active' })
      .orderBy('t.name', 'ASC');

    if (branchId) {
      qb.andWhere('t."branchId" = :branchId', { branchId });
    }
    return qb.getMany();
  }

  async listByTenant(
    tenantId: string,
    branchId?: string,
    sportType?: TurfSportType,
  ): Promise<TurfCourt[]> {
    if (!tenantId || tenantId === 'public') return [];
    const qb = this.turfRepo
      .createQueryBuilder('t')
      .where('t."tenantId" = :tenantId', { tenantId })
      .orderBy('t.name', 'ASC');
    if (branchId) {
      qb.andWhere('t."branchId" = :branchId', { branchId });
    }
    if (sportType) {
      qb.andWhere(':sportType = ANY(t."supportedSports")', { sportType });
    }
    return qb.getMany();
  }
}
