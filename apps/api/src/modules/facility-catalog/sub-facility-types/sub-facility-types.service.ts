import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SubFacilityType } from '../entities/sub-facility-type.entity';
import { CreateSubFacilityTypeDto } from './dto/create-sub-facility-type.dto';
import { FacilityTypesService } from '../facility-types/facility-types.service';

@Injectable()
export class SubFacilityTypesService {
  private readonly subFacilityTypes: SubFacilityType[] = [];

  constructor(private readonly facilityTypesService: FacilityTypesService) {}

  list(tenantId: string): SubFacilityType[] {
    return this.subFacilityTypes.filter((item) => item.tenantId === tenantId);
  }

  create(tenantId: string, dto: CreateSubFacilityTypeDto): SubFacilityType {
    const facilityTypes = this.facilityTypesService.list(tenantId);
    const parentType = facilityTypes.find((item) => item.id === dto.facilityTypeId);

    if (!parentType) {
      throw new BadRequestException(
        `Facility type ${dto.facilityTypeId} does not exist for tenant ${tenantId}`,
      );
    }

    const created: SubFacilityType = {
      id: randomUUID(),
      tenantId,
      facilityTypeId: dto.facilityTypeId,
      code: dto.code,
      name: dto.name,
      description: dto.description,
    };

    this.subFacilityTypes.push(created);
    return created;
  }
}
