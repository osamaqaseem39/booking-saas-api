import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../iam/entities/user.entity';
import { IamModule } from '../iam/iam.module';
import { SupportTicket } from './entities/support-ticket.entity';
import { SupportTicketMessage } from './entities/support-ticket-message.entity';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [
    IamModule,
    TypeOrmModule.forFeature([SupportTicket, SupportTicketMessage, User]),
  ],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
