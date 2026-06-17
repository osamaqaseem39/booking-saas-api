import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { isUUID } from 'class-validator';
import { CurrentTenant } from '../../tenancy/tenant-context.decorator';
import type { TenantContext } from '../../tenancy/tenant-context.interface';
import { ConsumerAuthGuard } from '../iam/authz/consumer-auth.guard';
import { PayEntityDto } from './dto/pay-entity.dto';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ConsumerPaymentsService } from './consumer-payments.service';
import { PaymentsService } from './payments.service';

@Controller()
export class ConsumerPaymentsController {
  constructor(
    private readonly consumerPayments: ConsumerPaymentsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  private userId(req: Request): string {
    return (req as Request & { userId?: string }).userId!.trim();
  }

  private tenantId(tenant: TenantContext): string | undefined {
    const id = tenant?.tenantId?.trim() ?? '';
    return isUUID(id, 4) ? id : undefined;
  }

  @Post('bookings/:bookingId/pay')
  @UseGuards(ConsumerAuthGuard)
  payBooking(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: PayEntityDto,
  ) {
    const key = req.headers['idempotency-key'] as string | undefined;
    return this.consumerPayments.initiateForEntity(
      'booking',
      bookingId,
      this.userId(req),
      dto,
      this.tenantId(tenant),
      key,
    );
  }

  @Get('bookings/:bookingId/payment-status')
  @UseGuards(ConsumerAuthGuard)
  paymentStatus(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.consumerPayments.getBookingPaymentStatus(
      bookingId,
      this.userId(req),
      this.tenantId(tenant),
    );
  }

  @Post('registrations/:registrationId/pay')
  @UseGuards(ConsumerAuthGuard)
  payRegistration(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Body() dto: PayEntityDto,
  ) {
    const key = req.headers['idempotency-key'] as string | undefined;
    return this.consumerPayments.initiateForEntity(
      'tournament_registration',
      registrationId,
      this.userId(req),
      dto,
      this.tenantId(tenant),
      key,
    );
  }

  @Post('payments/initiate')
  async initiate(@Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiate(dto.gateway, {
      amount: dto.amount,
      orderId: dto.orderId,
      customerEmail: dto.customerEmail,
      customerMobile: dto.customerMobile,
    });
  }

  @Post('payments/callback/:gateway')
  async callback(@Param('gateway') gateway: string, @Body() body: any) {
    return this.consumerPayments.handleCallback(gateway, body);
  }

  @Get('payments/callback/:gateway')
  async callbackGet(@Param('gateway') gateway: string, @Req() req: Request) {
    return this.consumerPayments.handleCallback(
      gateway,
      req.query as Record<string, unknown>,
    );
  }
}
