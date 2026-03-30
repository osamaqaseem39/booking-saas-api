import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../iam/authz/roles.decorator';
import { RolesGuard } from '../../iam/authz/roles.guard';
import { CurrentTenant } from '../../../tenancy/tenant-context.decorator';
import { TenantContext } from '../../../tenancy/tenant-context.interface';
import { CreateTurfCourtDto } from './dto/create-turf-court.dto';
import { UpdateTurfCourtDto } from './dto/update-turf-court.dto';
import { TurfCourtService } from './turf-court.service';
import type { TurfSportFilter } from './turf-sport-mode.util';

@Controller('arena/turf-courts')
@UseGuards(RolesGuard)
export class TurfCourtController {
  constructor(private readonly service: TurfCourtService) {}

  @Get()
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query('sport') sport?: string,
    @Query('businessLocationId') businessLocationId?: string,
  ) {
    let filter: TurfSportFilter | undefined;
    if (sport !== undefined && sport !== '') {
      if (sport !== 'futsal' && sport !== 'cricket') {
        throw new BadRequestException(
          'Query sport must be "futsal" or "cricket" (or omit for all turf courts)',
        );
      }
      filter = sport;
    }
    return this.service.list(tenant.tenantId, filter, businessLocationId);
  }

  @Get(':id')
  one(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(tenant.tenantId, id);
  }

  @Post()
  @Roles('platform-owner', 'business-admin')
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateTurfCourtDto,
  ) {
    return this.service.create(tenant.tenantId, dto);
  }

  @Patch(':id')
  @Roles('platform-owner', 'business-admin')
  patch(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTurfCourtDto,
  ) {
    return this.service.update(tenant.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('platform-owner', 'business-admin')
  remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(tenant.tenantId, id);
  }
}
