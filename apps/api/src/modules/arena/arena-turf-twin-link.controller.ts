import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentTenant } from '../../tenancy/tenant-context.decorator';
import type { TenantContext } from '../../tenancy/tenant-context.interface';
import { Roles } from '../iam/authz/roles.decorator';
import { RolesGuard } from '../iam/authz/roles.guard';
import { CricketCourtService } from './cricket-court/cricket-court.service';
import { FutsalCourtService } from './futsal-court/futsal-court.service';
import {
  CreateTurfTwinLinkDto,
  RemoveTurfTwinLinkDto,
} from './dto/upsert-turf-twin-link.dto';

@Controller('arena/turf-twin-links')
@UseGuards(RolesGuard)
export class ArenaTurfTwinLinkController {
  constructor(
    private readonly futsalCourtService: FutsalCourtService,
    private readonly cricketCourtService: CricketCourtService,
  ) {}

  @Post('link')
  @Roles('platform-owner', 'business-admin')
  async link(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateTurfTwinLinkDto,
  ) {
    const futsal = await this.futsalCourtService.update(tenant.tenantId, dto.futsalCourtId, {
      linkedTwinCourtKind: 'cricket_court',
      linkedTwinCourtId: dto.cricketCourtId,
    });

    const cricket = await this.cricketCourtService.findOne(
      tenant.tenantId,
      dto.cricketCourtId,
    );

    return {
      message: 'Shared turf link created. Cricket and futsal now share one booking calendar.',
      link: {
        futsalCourtId: futsal.id,
        cricketCourtId: cricket.id,
      },
      courts: { futsal, cricket },
    };
  }

  @Post('unlink')
  @Roles('platform-owner', 'business-admin')
  async unlink(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: RemoveTurfTwinLinkDto,
  ) {
    if (dto.courtKind === 'futsal_court') {
      const futsal = await this.futsalCourtService.unlinkTwin(tenant.tenantId, dto.courtId);
      return {
        message: 'Shared turf link removed.',
        unlinkedFrom: { courtKind: dto.courtKind, courtId: dto.courtId },
        court: futsal,
      };
    }

    const cricket = await this.cricketCourtService.unlinkTwin(tenant.tenantId, dto.courtId);
    return {
      message: 'Shared turf link removed.',
      unlinkedFrom: { courtKind: dto.courtKind, courtId: dto.courtId },
      court: cricket,
    };
  }
}
