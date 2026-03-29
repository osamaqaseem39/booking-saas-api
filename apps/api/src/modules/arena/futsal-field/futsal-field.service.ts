import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';
import { BusinessesService } from '../../businesses/businesses.service';
import { assertFacilityTypeAllowedForLocation } from '../location-facility.util';
import { CreateFutsalFieldDto } from './dto/create-futsal-field.dto';
import { UpdateFutsalFieldDto } from './dto/update-futsal-field.dto';
import { FutsalField } from './entities/futsal-field.entity';

const FUTSAL_LOCATION_FACILITY_CODE = 'futsal-field' as const;

@Injectable()
export class FutsalFieldService {
  constructor(
    @InjectRepository(FutsalField)
    private readonly repo: Repository<FutsalField>,
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
  ): Promise<FutsalField[]> {
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

  async create(tenantId: string, dto: CreateFutsalFieldDto): Promise<FutsalField> {
    this.requireTenant(tenantId);
    const location = await this.businessesService.assertLocationBelongsToTenant(
      dto.businessLocationId,
      tenantId,
    );
    assertFacilityTypeAllowedForLocation(location, FUTSAL_LOCATION_FACILITY_CODE);
    const row = this.repo.create({
      tenantId,
      businessLocationId: dto.businessLocationId,
      name: dto.name,
      description: dto.description,
      dimensions: dto.dimensions,
    });
    return this.repo.save(row);
  }

  async findOne(tenantId: string, id: string): Promise<FutsalField> {
    this.requireTenant(tenantId);
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) {
      throw new NotFoundException(`Futsal field ${id} not found`);
    }
    return row;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateFutsalFieldDto,
  ): Promise<FutsalField> {
    const row = await this.findOne(tenantId, id);
    Object.assign(row, dto);
    return this.repo.save(row);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const row = await this.findOne(tenantId, id);
    await this.repo.remove(row);
  }
}
