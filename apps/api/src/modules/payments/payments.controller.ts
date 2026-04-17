import { Body, Controller, Param, Post, Get, Query, Req } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  async initiate(@Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiate(dto.gateway, {
      amount: dto.amount,
      orderId: dto.orderId,
      customerEmail: dto.customerEmail,
      customerMobile: dto.customerMobile,
    });
  }

  @Post('callback/:gateway')
  async callback(@Param('gateway') gateway: string, @Body() body: any) {
    return this.paymentsService.handleCallback(gateway, body);
  }

  // Some gateways use GET for return URLs
  @Get('callback/:gateway')
  async callbackGet(@Param('gateway') gateway: string, @Query() query: any) {
    return this.paymentsService.handleCallback(gateway, query);
  }
}
