import { Body, Controller, Get, Post, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { CurrentTenant } from '../../tenancy/tenant-context.decorator';
import { TenantContext } from '../../tenancy/tenant-context.interface';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoices')
  listInvoices(@Req() req: Request, @CurrentTenant() tenant: TenantContext) {
    const userId = (req as any).userId?.trim();
    if (!userId) throw new UnauthorizedException('Missing user');
    return this.billingService.list(userId, tenant?.tenantId?.trim() || undefined);
  }

  @Post('invoices')
  issueInvoice(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: IssueInvoiceDto,
  ) {
    return this.billingService.issue(
      tenant.tenantId,
      dto.bookingId,
      dto.amount,
    );
  }
}
