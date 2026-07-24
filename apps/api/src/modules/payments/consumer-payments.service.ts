import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, IsNull, Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { PaymentTransaction } from '../bookings/entities/payment-transaction.entity';
import { TournamentRegistration } from '../tournaments/entities/tournament-registration.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { TournamentDivision } from '../tournaments/entities/tournament-division.entity';
import { TeamMember } from '../tournaments/entities/team-member.entity';
import { CanteenOrder } from '../canteen/entities/canteen-order.entity';
import {
  PaymentAttempt,
  type PaymentAttemptStatus,
  type PaymentEntityType,
} from './entities/payment-attempt.entity';
import { PaymentsService } from './payments.service';
import { AnalyticsService } from '../analytics/analytics.service';

const PAYMENT_HOLD_MINUTES = 15;

function numFromDec(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return Number(v);
}

function normalizeMobile(raw?: string): string {
  const s = (raw ?? '').replace(/\D/g, '');
  if (s.startsWith('92') && s.length >= 12) return s.slice(2);
  if (s.startsWith('0')) return s.slice(1);
  return s;
}

@Injectable()
export class ConsumerPaymentsService {
  constructor(
    @InjectRepository(PaymentAttempt)
    private readonly attempts: Repository<PaymentAttempt>,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(TournamentRegistration)
    private readonly registrations: Repository<TournamentRegistration>,
    @InjectRepository(Tournament)
    private readonly tournaments: Repository<Tournament>,
    @InjectRepository(TournamentDivision)
    private readonly divisions: Repository<TournamentDivision>,
    @InjectRepository(TeamMember)
    private readonly teamMembers: Repository<TeamMember>,
    @InjectRepository(CanteenOrder)
    private readonly canteenOrders: Repository<CanteenOrder>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentTxns: Repository<PaymentTransaction>,
    private readonly paymentsService: PaymentsService,
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}

  private async expireStaleAttempts(): Promise<void> {
    const now = new Date();
    await this.attempts.update(
      {
        status: 'initiated' as PaymentAttemptStatus,
        expiresAt: LessThan(now),
      },
      { status: 'expired' as PaymentAttemptStatus },
    );
  }

  private formatAttemptResponse(attempt: PaymentAttempt) {
    const { pp_Password: _p, ...formFields } =
      (attempt.gatewayFormFields ?? {}) as Record<string, string>;
    return {
      paymentAttemptId: attempt.id,
      entityType: attempt.entityType,
      entityId: attempt.entityId,
      gateway: attempt.gateway,
      amount: numFromDec(attempt.amount),
      currency: attempt.currency,
      status: attempt.status,
      transactionId: attempt.transactionId,
      expiresAt: attempt.expiresAt.toISOString(),
      paymentUrl: attempt.paymentUrl ?? undefined,
      gatewayFormFields: formFields,
    };
  }

  private async assertBookingOwner(
    bookingId: string,
    userId: string,
    tenantId?: string,
  ): Promise<Booking> {
    const booking = await this.bookings.findOne({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (tenantId && booking.tenantId !== tenantId) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.userId !== userId) {
      throw new ForbiddenException('Not booking owner');
    }
    return booking;
  }

  private async assertRegistrationOwner(
    registrationId: string,
    userId: string,
    tenantId?: string,
  ): Promise<{
    reg: TournamentRegistration;
    division: TournamentDivision;
    event: Tournament;
  }> {
    const reg = await this.registrations.findOne({
      where: { id: registrationId },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    const division = await this.divisions.findOne({
      where: { id: reg.divisionId, deletedAt: IsNull() },
    });
    if (!division) throw new NotFoundException('Tournament not found');
    const event = await this.tournaments.findOne({
      where: { id: division.tournamentId, deletedAt: IsNull() },
    });
    if (!event) throw new NotFoundException('Tournament not found');
    if (tenantId && event.tenantId !== tenantId) {
      throw new NotFoundException('Registration not found');
    }
    const member = await this.teamMembers.findOne({
      where: { teamId: reg.teamId, userId },
    });
    if (!member) {
      throw new ForbiddenException('Not registration owner');
    }
    return { reg, division, event };
  }

  private assertPayable(
    entityType: PaymentEntityType,
    booking?: Booking,
    reg?: TournamentRegistration,
    division?: TournamentDivision,
    event?: Tournament,
  ): { amount: number; entityId: string; tenantId: string } {
    if (entityType === 'booking' && booking) {
      if (['cancelled', 'completed'].includes(booking.bookingStatus)) {
        throw new BadRequestException('Booking not payable');
      }
      if (booking.paymentStatus === 'paid') {
        throw new BadRequestException('Booking already paid');
      }
      const remaining =
        numFromDec(booking.totalAmount) - numFromDec(booking.paidAmount);
      if (remaining <= 0) {
        throw new BadRequestException('Booking not payable');
      }
      return {
        amount: remaining,
        entityId: booking.id,
        tenantId: booking.tenantId,
      };
    }
    if (entityType === 'tournament_registration' && reg && division && event) {
      if (reg.paymentStatus === 'paid') {
        throw new BadRequestException('Registration already paid');
      }
      const fee = numFromDec(division.entryFeeAmount);
      if (fee <= 0) {
        throw new BadRequestException('No entry fee required');
      }
      return {
        amount: fee,
        entityId: reg.id,
        tenantId: event.tenantId,
      };
    }
    throw new BadRequestException('Entity not payable');
  }

  async initiateForEntity(
    entityType: PaymentEntityType,
    entityId: string,
    userId: string,
    dto: {
      gateway: string;
      customerMobile?: string;
      customerEmail?: string;
      returnUrl?: string;
    },
    tenantId?: string,
    idempotencyKey?: string,
  ) {
    await this.expireStaleAttempts();

    if (idempotencyKey) {
      const existing = await this.attempts.findOne({
        where: { idempotencyKey },
      });
      if (existing) return this.formatAttemptResponse(existing);
    }

    let booking: Booking | undefined;
    let reg: TournamentRegistration | undefined;
    let division: TournamentDivision | undefined;
    let event: Tournament | undefined;

    if (entityType === 'booking') {
      booking = await this.assertBookingOwner(entityId, userId, tenantId);
    } else if (entityType === 'tournament_registration') {
      const resolved = await this.assertRegistrationOwner(
        entityId,
        userId,
        tenantId,
      );
      reg = resolved.reg;
      division = resolved.division;
      event = resolved.event;
    }

    const { amount, entityId: eid, tenantId: tid } = this.assertPayable(
      entityType,
      booking,
      reg,
      division,
      event,
    );

    const inProgress = await this.attempts.findOne({
      where: {
        entityType,
        entityId: eid,
        status: 'initiated' as PaymentAttemptStatus,
      },
      order: { createdAt: 'DESC' },
    });
    if (
      inProgress &&
      inProgress.expiresAt > new Date() &&
      inProgress.userId === userId
    ) {
      return this.formatAttemptResponse(inProgress);
    }

    const init = await this.paymentsService.initiate(dto.gateway, {
      amount,
      orderId: eid,
      customerMobile: normalizeMobile(dto.customerMobile),
      customerEmail: dto.customerEmail,
    });

    const expiresAt = new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60_000);
    const formFields = init.gatewayRawResponse as Record<string, string>;

    const attempt = await this.attempts.save({
      entityType,
      entityId: eid,
      tenantId: tid,
      userId,
      gateway: dto.gateway,
      amount: String(amount),
      currency: 'PKR',
      status: 'initiated',
      transactionId: init.transactionId,
      idempotencyKey: idempotencyKey ?? null,
      gatewayFormFields: formFields,
      paymentUrl: init.paymentUrl ?? null,
      returnUrl: dto.returnUrl ?? null,
      expiresAt,
    });

    if (entityType === 'booking' && booking) {
      booking.paymentMethod = dto.gateway as Booking['paymentMethod'];
      booking.paymentStatus = 'pending';
      booking.bookingStatus = 'pending';
      await this.bookings.save(booking);
    }

    return this.formatAttemptResponse(attempt);
  }

  async getBookingPaymentStatus(
    bookingId: string,
    userId: string,
    tenantId?: string,
  ) {
    await this.expireStaleAttempts();
    const booking = await this.assertBookingOwner(bookingId, userId, tenantId);
    const latest = await this.attempts.findOne({
      where: { entityType: 'booking', entityId: bookingId },
      order: { createdAt: 'DESC' },
    });

    const amountDue =
      numFromDec(booking.totalAmount) - numFromDec(booking.paidAmount);

    return {
      bookingId,
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.bookingStatus,
      amountDue,
      paidAmount: numFromDec(booking.paidAmount),
      currency: 'PKR',
      latestAttempt: latest
        ? {
            id: latest.id,
            gateway: latest.gateway,
            status: latest.status,
            transactionId: latest.transactionId,
            failureReason: latest.failureReason ?? null,
            createdAt: latest.createdAt.toISOString(),
            completedAt: latest.completedAt?.toISOString() ?? null,
            expiresAt: latest.expiresAt.toISOString(),
          }
        : null,
      canRetry:
        booking.paymentStatus !== 'paid' &&
        (!latest ||
          ['failed', 'expired', 'cancelled'].includes(latest.status)),
    };
  }

  async handleCallback(gateway: string, body: Record<string, unknown>) {
    const result = await this.paymentsService.handleCallback(gateway, body);
    const txnRef =
      (body.pp_TxnRefNo as string) ??
      (body.transactionId as string) ??
      result.transactionId;
    const billRef = (body.pp_BillReference as string) ?? null;

    let attempt = await this.attempts.findOne({
      where: { transactionId: txnRef },
    });
    if (!attempt && billRef) {
      attempt = await this.attempts.findOne({
        where: { entityId: billRef },
        order: { createdAt: 'DESC' },
      });
    }
    if (!attempt) {
      return result;
    }

    if (attempt.status === 'succeeded') {
      return {
        success: true,
        transactionId: attempt.transactionId,
        status: 'paid',
      };
    }

    const now = new Date();
    if (result.success) {
      attempt.status = 'succeeded';
      attempt.completedAt = now;
      await this.attempts.save(attempt);
      await this.fulfillPayment(attempt, 'succeeded');
      return {
        success: true,
        transactionId: attempt.transactionId,
        status: 'paid',
      };
    }

    attempt.status = 'failed';
    attempt.failureReason =
      (body.pp_ResponseMessage as string) ?? 'Payment failed';
    attempt.completedAt = now;
    await this.attempts.save(attempt);

    if (attempt.entityType === 'booking') {
      const booking = await this.bookings.findOne({
        where: { id: attempt.entityId },
      });
      if (booking && booking.paymentStatus !== 'paid') {
        const fromStatus = booking.paymentStatus;
        booking.paymentStatus = 'failed';
        await this.bookings.save(booking);
        this.emitPaymentStatusChanged(attempt, fromStatus, 'failed');
      }
    }

    return {
      success: false,
      transactionId: attempt.transactionId,
      status: 'failed',
    };
  }

  private async fulfillPayment(
    attempt: PaymentAttempt,
    toStatus: 'succeeded' | 'failed' = 'succeeded',
  ): Promise<void> {
    const amount = numFromDec(attempt.amount);
    const now = new Date();

    if (attempt.entityType === 'booking') {
      const booking = await this.bookings.findOne({
        where: { id: attempt.entityId },
      });
      if (!booking) return;
      const fromStatus = booking.paymentStatus;
      booking.paymentStatus = 'paid';
      booking.bookingStatus = 'confirmed';
      booking.paidAmount = booking.totalAmount;
      booking.transactionId = attempt.transactionId;
      booking.paidAt = now;
      booking.paymentMethod = attempt.gateway as Booking['paymentMethod'];
      await this.bookings.save(booking);
      await this.paymentTxns.save({
        bookingId: booking.id,
        method: attempt.gateway as PaymentTransaction['method'],
        amount: String(amount),
        transactionRef: attempt.transactionId,
        note: 'Online payment',
        paidAt: now,
      });
      if (toStatus === 'succeeded') {
        this.emitPaymentStatusChanged(attempt, fromStatus, 'paid');
      }
      return;
    }

    if (attempt.entityType === 'tournament_registration') {
      const reg = await this.registrations.findOne({
        where: { id: attempt.entityId },
      });
      if (reg) {
        reg.paymentStatus = 'paid';
        await this.registrations.save(reg);
      }
      return;
    }

    if (attempt.entityType === 'canteen_order') {
      const order = await this.canteenOrders.findOne({
        where: { id: attempt.entityId },
      });
      if (order) {
        order.paymentStatus = 'paid';
        await this.canteenOrders.save(order);
      }
    }
  }

  private emitPaymentStatusChanged(
    attempt: PaymentAttempt,
    fromStatus: string,
    toStatus: string,
  ): void {
    if (!this.analytics || attempt.entityType !== 'booking') return;
    this.analytics.emitServerEvent({
      eventName: 'payment_status_changed_server',
      tenantId: attempt.tenantId,
      userId: attempt.userId,
      properties: {
        booking_id: attempt.entityId,
        payment_id: attempt.id,
        from_status: fromStatus,
        to_status: toStatus,
        value: numFromDec(attempt.amount),
        currency: attempt.currency ?? 'PKR',
      },
    });
  }
}
