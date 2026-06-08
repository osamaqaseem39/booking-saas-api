import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(private readonly webhook: WhatsappWebhookService) {}

  @Get()
  verify(@Query() query: Record<string, string | undefined>) {
    const challenge = this.webhook.verifySubscribe(query);
    if (!challenge) throw new ForbiddenException('Webhook verification failed');
    return challenge;
  }

  @Post()
  @HttpCode(200)
  async receive(@Req() req: Request & { rawBody?: Buffer }) {
    try {
      this.webhook.assertValidSignature(req.rawBody, req.header('x-hub-signature-256'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid signature';
      throw new ForbiddenException(msg);
    }
    try {
      await this.webhook.handlePayload(req.body);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`WhatsApp webhook handler failed: ${msg}`);
      throw new BadRequestException('Webhook processing failed');
    }
    return { ok: true };
  }
}
