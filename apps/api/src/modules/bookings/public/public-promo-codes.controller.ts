import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentTenant } from '../../../tenancy/tenant-context.decorator';
import { TenantContext } from '../../../tenancy/tenant-context.interface';
import { ConsumerAuthGuard } from '../../iam/authz/consumer-auth.guard';
import { ValidatePromoCodeDto } from '../dto/promo-code.dto';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { isUUID } from 'class-validator';

@Controller('public/promo-codes')
@UseGuards(ConsumerAuthGuard)
export class PublicPromoCodesController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  @Post('validate')
  @HttpCode(200)
  validate(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: ValidatePromoCodeDto,
  ) {
    const tenantId = tenant?.tenantId?.trim() ?? '';
    if (!isUUID(tenantId, 4)) {
      throw new BadRequestException('X-Tenant-Id is required.');
    }
    return this.promoCodesService.validate(tenantId, dto.code, dto.subTotal);
  }
}
