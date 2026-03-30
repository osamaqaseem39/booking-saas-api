import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';
import { BusinessesService } from '../../businesses/businesses.service';
import { assertFacilityTypeAllowedForLocation } from '../location-facility.util';
import { CreateCricketIndoorCourtDto } from './dto/create-cricket-indoor-court.dto';
import { UpdateCricketIndoorCourtDto } from './dto/update-cricket-indoor-court.dto';
import { CricketIndoorCourt } from './entities/cricket-indoor-court.entity';

const CRICKET_LOCATION_FACILITY_CODE = 'cricket-indoor' as const;

@Injectable()
export class CricketIndoorService {
  constructor(
    @InjectRepository(CricketIndoorCourt)
    private readonly repo: Repository<CricketIndoorCourt>,
    private readonly businessesService: BusinessesService,
  ) {}

  private requireTenant(tenantId: string): void {
    if (!tenantId || tenantId === 'public') {
      throw new BadRequestException(
        'A valid business tenant is required (send x-tenant-id)',
      );
    }
  }

  async list(
    tenantId: string,
    businessLocationId?: string,
  ): Promise<CricketIndoorCourt[]> {
    if (!tenantId || tenantId === 'public') return [];
    if (
      businessLocationId !== undefined &&
      businessLocationId !== '' &&
      !isUUID(businessLocationId, '4')
    ) {
      throw new BadRequestException('businessLocationId must be a UUID v4');
    }
    const locWhere =
      businessLocationId && businessLocationId !== ''
        ? { businessLocationId }
        : {};
    return this.repo.find({
      where: { tenantId, ...locWhere },
      order: { name: 'ASC' },
    });
  }

  async create(
    tenantId: string,
    dto: CreateCricketIndoorCourtDto,
  ): Promise<CricketIndoorCourt> {
    this.requireTenant(tenantId);
    const location = await this.businessesService.assertLocationBelongsToTenant(
      dto.businessLocationId,
      tenantId,
    );
    assertFacilityTypeAllowedForLocation(
      location,
      CRICKET_LOCATION_FACILITY_CODE,
    );
    const row = this.repo.create({
      tenantId,
      businessLocationId: dto.businessLocationId,
      name: dto.name,
      description: dto.description,
      laneCount: dto.laneCount,
    });
    return this.repo.save(row);
  }

  async findOne(tenantId: string, id: string): Promise<CricketIndoorCourt> {
    this.requireTenant(tenantId);
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) {
      throw new NotFoundException(`Cricket indoor court ${id} not found`);
    }
    return row;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateCricketIndoorCourtDto,
  ): Promise<CricketIndoorCourt> {
    const row = await this.findOne(tenantId, id);
    Object.assign(row, dto);
    return this.repo.save(row);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const row = await this.findOne(tenantId, id);
    await this.repo.remove(row);
  }
}
