import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IamModule } from '../iam/iam.module';
import { Booking } from '../bookings/entities/booking.entity';
import { PaymentTransaction } from '../bookings/entities/payment-transaction.entity';
import { TournamentRegistration } from '../tournaments/entities/tournament-registration.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { TournamentDivision } from '../tournaments/entities/tournament-division.entity';
import { TeamMember } from '../tournaments/entities/team-member.entity';
import { CanteenOrder } from '../canteen/entities/canteen-order.entity';
import { PaymentAttempt } from './entities/payment-attempt.entity';
import { ConsumerPaymentsController } from './consumer-payments.controller';
import { ConsumerPaymentsService } from './consumer-payments.service';
import { PaymentsService } from './payments.service';
import { EasypaisaProvider } from './providers/easypaisa.provider';
import { JazzCashProvider } from './providers/jazzcash.provider';

@Module({
  imports: [
    ConfigModule,
    IamModule,
    TypeOrmModule.forFeature([
      PaymentAttempt,
      Booking,
      PaymentTransaction,
      TournamentRegistration,
      Tournament,
      TournamentDivision,
      TeamMember,
      CanteenOrder,
    ]),
  ],
  controllers: [ConsumerPaymentsController],
  providers: [
    PaymentsService,
    ConsumerPaymentsService,
    EasypaisaProvider,
    JazzCashProvider,
  ],
  exports: [PaymentsService, ConsumerPaymentsService],
})
export class PaymentsModule {}
