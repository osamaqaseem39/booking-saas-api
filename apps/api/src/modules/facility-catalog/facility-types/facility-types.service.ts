import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateFacilityTypeDto } from './dto/create-facility-type.dto';
import { FacilityType } from '../entities/facility-type.entity';

@Injectable()
export class FacilityTypesService {
  private readonly facilityTypes: FacilityType[] = [];

  list(tenantId: string): FacilityType[] {
    return this.facilityTypes.filter((item) => item.tenantId === tenantId);
  }

  create(tenantId: string, dto: CreateFacilityTypeDto): FacilityType {
    const created: FacilityType = {
      id: randomUUID(),
      tenantId,
      code: dto.code,
      name: dto.name,
      description: dto.description,
    };

    this.facilityTypes.push(created);
    return created;
  }
}
