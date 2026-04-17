import { Injectable, NotFoundException } from '@nestjs/common';
import { EasypaisaProvider } from './providers/easypaisa.provider';
import { JazzCashProvider } from './providers/jazzcash.provider';
import { PaymentInitOptions, PaymentInitResponse } from './interfaces/payment-provider.interface';

@Injectable()
export class PaymentsService {
  private providers = new Map<string, any>();

  constructor(
    private easypaisa: EasypaisaProvider,
    private jazzcash: JazzCashProvider,
  ) {
    this.providers.set('easypaisa', easypaisa);
    this.providers.set('jazzcash', jazzcash);
  }

  async initiate(gateway: string, options: PaymentInitOptions): Promise<PaymentInitResponse> {
    const provider = this.providers.get(gateway);
    if (!provider) {
      throw new NotFoundException(`Payment gateway ${gateway} not supported`);
    }

    return provider.initiatePayment(options);
  }

  async handleCallback(gateway: string, body: any) {
    const provider = this.providers.get(gateway);
    if (!provider) {
      throw new NotFoundException(`Payment gateway ${gateway} not supported`);
    }

    return provider.processCallback(body);
  }
}
