import { Injectable, UnauthorizedException } from '@nestjs/common';
import { IamService } from '../iam/iam.service';
import { randomUUID } from 'crypto';

interface InvoiceRecord {
  id: string;
  tenantId: string;
  bookingId: string;
  amount: number;
  currency: 'PKR' | 'USD';
  status: 'issued' | 'paid';
}

@Injectable()
export class BillingService {
  private readonly invoices: InvoiceRecord[] = [];

  constructor(private readonly iamService: IamService) {}

  async list(requesterUserId: string, tenantId?: string): Promise<InvoiceRecord[]> {
    const isPlatformOwner = await this.iamService.hasAnyRole(requesterUserId, ['platform-owner']);
    
    if (tenantId) {
      return this.invoices.filter((invoice) => invoice.tenantId === tenantId);
    }
    
    if (isPlatformOwner) {
      return this.invoices;
    }
    
    throw new UnauthorizedException('Tenant ID is required');
  }

  issue(tenantId: string, bookingId: string, amount: number): InvoiceRecord {
    const invoice: InvoiceRecord = {
      id: randomUUID(),
      tenantId,
      bookingId,
      amount,
      currency: 'PKR',
      status: 'issued',
    };
    this.invoices.push(invoice);
    return invoice;
  }
}
