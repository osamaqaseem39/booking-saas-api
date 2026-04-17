import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { IPaymentProvider, PaymentInitOptions, PaymentInitResponse } from '../interfaces/payment-provider.interface';

@Injectable()
export class EasypaisaProvider implements IPaymentProvider {
  private readonly logger = new Logger(EasypaisaProvider.name);
  public readonly name = 'easypaisa';

  constructor(private configService: ConfigService) {}

  private get config() {
    return {
      storeId: this.configService.get<string>('EASYPAISA_STORE_ID', '12345'),
      hashKey: this.configService.get<string>('EASYPAISA_HASH_KEY', 'default_hash_key'),
      baseUrl: this.configService.get<string>('EASYPAISA_BASE_URL', 'https://easypay-stg.easypaisa.com.pk/easypay/Index.jsf'),
      returnUrl: this.configService.get<string>('EASYPAISA_RETURN_URL', 'http://localhost:3000/payments/callback/easypaisa'),
    };
  }

  async initiatePayment(options: PaymentInitOptions): Promise<PaymentInitResponse> {
    const { amount, orderId } = options;
    const { storeId, hashKey, baseUrl, returnUrl } = this.config;

    // Simple implementation for Easypaisa Hosted Checkout Redirect logic
    // In a real scenario, you'd generate a hash based on Easypaisa specs
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    
    // Example of hash generation (this varies by API version)
    const rawData = `amount=${amount}&orderRefNum=${orderId}&paymentMethod=MA_PAYMENT&storeId=${storeId}&timeStamp=${timestamp}`;
    const hash = crypto.createHmac('sha256', hashKey).update(rawData).digest('hex');

    // For hosted checkout, we typically redirect with these as query params or form body
    // Here we return a constructed URL for simplicity in this demo
    const paymentUrl = `${baseUrl}?storeId=${storeId}&amount=${amount}&orderRefNum=${orderId}&expiryDate=20261231&merchantHmac=${hash}`;

    return {
      paymentUrl,
      transactionId: orderId,
      method: 'wallet',
      gatewayRawResponse: { timestamp, hash }
    };
  }

  verifySignature(params: any): boolean {
    const { auth_token, post_back_auth_token } = params;
    // Implementation depends on Easypaisa callback signature
    return true; // Placeholder
  }

  async processCallback(params: any): Promise<{ success: boolean; transactionId: string; status: string }> {
    this.logger.log(`Processing Easypaisa callback: ${JSON.stringify(params)}`);
    
    // Logic to verify response from Easypaisa
    const success = params.responseCode === '0000';
    
    return {
      success,
      transactionId: params.orderRefNum,
      status: success ? 'paid' : 'failed'
    };
  }
}
