import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { IPaymentProvider, PaymentInitOptions, PaymentInitResponse } from '../interfaces/payment-provider.interface';

@Injectable()
export class JazzCashProvider implements IPaymentProvider {
  private readonly logger = new Logger(JazzCashProvider.name);
  public readonly name = 'jazzcash';

  constructor(private configService: ConfigService) {}

  private get config() {
    return {
      merchantId: this.configService.get<string>('JAZZCASH_MERCHANT_ID', 'MC12345'),
      password: this.configService.get<string>('JAZZCASH_PASSWORD', 'pass123'),
      integritySalt: this.configService.get<string>('JAZZCASH_INTEGRITY_SALT', 'salt123'),
      baseUrl: this.configService.get<string>('JAZZCASH_BASE_URL', 'https://sandbox.jazzcash.com.pk/CustomerPortal/transaction/Checkout'),
      returnUrl: this.configService.get<string>('JAZZCASH_RETURN_URL', 'http://localhost:3000/payments/callback/jazzcash'),
    };
  }

  async initiatePayment(options: PaymentInitOptions): Promise<PaymentInitResponse> {
    const { amount, orderId } = options;
    const { merchantId, password, integritySalt, baseUrl, returnUrl } = this.config;

    const txnDateTime = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const expiryDateTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

    const params: any = {
      pp_Version: '1.1',
      pp_TxnType: 'MWALLET', // Mobile Wallet
      pp_Language: 'EN',
      pp_MerchantID: merchantId,
      pp_Password: password,
      pp_TxnRefNo: `T${txnDateTime}`,
      pp_Amount: (amount * 100).toString(), // JazzCash expects amount in Paisas
      pp_TxnCurrency: 'PKR',
      pp_TxnDateTime: txnDateTime,
      pp_BillReference: orderId,
      pp_Description: `Payment for Order ${orderId}`,
      pp_TxnExpiryDateTime: expiryDateTime,
      pp_ReturnURL: returnUrl,
      pp_SecureHash: '',
      ppmpf_1: options.customerMobile || '',
    };

    // Sort keys and create secure hash
    const sortedKeys = Object.keys(params).sort();
    let hashString = integritySalt;
    for (const key of sortedKeys) {
      if (params[key] !== '' && key !== 'pp_SecureHash') {
        hashString += '&' + params[key];
      }
    }

    params.pp_SecureHash = crypto
      .createHmac('sha256', integritySalt)
      .update(hashString)
      .digest('hex')
      .toUpperCase();

    // In a real scenario, you'd return these params to the frontend to submit as a form
    // or return a hosted checkout URL if supported by the specific API version
    return {
      transactionId: params.pp_TxnRefNo,
      method: 'wallet',
      gatewayRawResponse: params,
      paymentUrl: baseUrl // The client would POST the params to this URL
    };
  }

  verifySignature(params: any): boolean {
    const { pp_SecureHash } = params;
    // Implementation to verify JazzCash callback signature
    return true; // Placeholder
  }

  async processCallback(params: any): Promise<{ success: boolean; transactionId: string; status: string }> {
    this.logger.log(`Processing JazzCash callback: ${JSON.stringify(params)}`);
    
    const success = params.pp_ResponseCode === '000';
    
    return {
      success,
      transactionId: params.pp_TxnRefNo,
      status: success ? 'paid' : 'failed'
    };
  }
}
