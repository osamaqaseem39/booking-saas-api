import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../iam/entities/user.entity';
import { IamModule } from '../iam/iam.module';
import { TournamentRegistration } from '../tournaments/entities/tournament-registration.entity';
import { TeamMember } from '../tournaments/entities/team-member.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { TournamentDivision } from '../tournaments/entities/tournament-division.entity';
import { CanteenOrder } from '../canteen/entities/canteen-order.entity';
import { SupportTicket } from '../support/entities/support-ticket.entity';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { JourneyEvent } from './entities/journey-event.entity';
import { JourneyController } from './journey.controller';
import { JourneyService } from './journey.service';

@Module({
  imports: [
    IamModule,
    TypeOrmModule.forFeature([
      JourneyEvent,
      User,
      Booking,
      TournamentRegistration,
      TeamMember,
      Tournament,
      TournamentDivision,
      CanteenOrder,
      SupportTicket,
    ]),
  ],
  controllers: [JourneyController],
  providers: [JourneyService],
})
export class JourneyModule {}
