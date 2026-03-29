import { Injectable } from '@nestjs/common';
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

  list(tenantId: string): InvoiceRecord[] {
    return this.invoices.filter((invoice) => invoice.tenantId === tenantId);
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
