export interface PaymentInitOptions {
  amount: number;
  orderId: string;
  customerMobile?: string;
  customerEmail?: string;
}

export interface PaymentInitResponse {
  paymentUrl?: string; // For hosted checkout
  transactionId: string;
  gatewayRawResponse?: any;
  method: 'wallet' | 'otc' | 'card';
}

export interface IPaymentProvider {
  name: string;
  initiatePayment(options: PaymentInitOptions): Promise<PaymentInitResponse>;
  verifySignature(params: any): boolean;
  processCallback(params: any): Promise<{ success: boolean; transactionId: string; status: string }>;
}
