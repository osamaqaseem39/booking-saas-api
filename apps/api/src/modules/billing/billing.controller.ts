import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentTenant } from '../../tenancy/tenant-context.decorator';
import { TenantContext } from '../../tenancy/tenant-context.interface';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoices')
  listInvoices(@CurrentTenant() tenant: TenantContext) {
    return this.billingService.list(tenant.tenantId);
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
