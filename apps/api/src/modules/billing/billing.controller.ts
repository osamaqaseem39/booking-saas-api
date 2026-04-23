import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CurrentTenant } from '../../tenancy/tenant-context.decorator';
import { TenantContext } from '../../tenancy/tenant-context.interface';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { BillingService, InvoiceRecord } from './billing.service';
import { Roles } from '../iam/authz/roles.decorator';
import { RolesGuard } from '../iam/authz/roles.guard';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoices')
  @UseGuards(RolesGuard)
  @Roles('platform-owner', 'business-admin', 'location-admin', 'business-staff')
  listInvoices(@Req() req: Request, @CurrentTenant() tenant: TenantContext): Promise<InvoiceRecord[]> {
    const userId = (req as any).userId?.trim();
    if (!userId) throw new UnauthorizedException('Missing user');
    return this.billingService.list(userId, tenant?.tenantId?.trim() || undefined);
  }

  @Post('invoices')
  issueInvoice(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: IssueInvoiceDto,
  ): InvoiceRecord {
    return this.billingService.issue(
      tenant.tenantId,
      dto.bookingId,
      dto.amount,
    );
  }
}
