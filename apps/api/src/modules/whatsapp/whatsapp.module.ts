import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsModule } from '../bookings/bookings.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { Business } from '../businesses/entities/business.entity';
import { BusinessMembership } from '../businesses/entities/business-membership.entity';
import { IamModule } from '../iam/iam.module';
import { User } from '../iam/entities/user.entity';
import { UserRole } from '../iam/entities/user-role.entity';
import { WhatsappChannel } from './entities/whatsapp-channel.entity';
import { WhatsappConversation } from './entities/whatsapp-conversation.entity';
import { WhatsappProcessedMessage } from './entities/whatsapp-processed-message.entity';
import { WhatsappBookingService } from './whatsapp-booking.service';
import { WhatsappBotService } from './whatsapp-bot.service';
import { WhatsappChannelsController } from './whatsapp-channels.controller';
import { WhatsappChannelsService } from './whatsapp-channels.service';
import { WhatsappConversationsService } from './whatsapp-conversations.service';
import { WhatsappSendService } from './whatsapp-send.service';
import { WhatsappInboundDedupService } from './whatsapp-inbound-dedup.service';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WhatsappChannel,
      WhatsappConversation,
      WhatsappProcessedMessage,
      Business,
      BusinessMembership,
      User,
      UserRole,
    ]),
    IamModule,
    BusinessesModule,
    BookingsModule,
  ],
  controllers: [WhatsappChannelsController, WhatsappWebhookController],
  providers: [
    WhatsappChannelsService,
    WhatsappConversationsService,
    WhatsappBookingService,
    WhatsappBotService,
    WhatsappWebhookService,
    WhatsappInboundDedupService,
    WhatsappSendService,
  ],
  exports: [
    WhatsappChannelsService,
    WhatsappBotService,
    WhatsappWebhookService,
    WhatsappSendService,
  ],
})
export class WhatsappModule {}
