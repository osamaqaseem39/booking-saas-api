import {
  BadRequestException,
  Controller,
  ForbiddenException,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { WhatsappOpenwaWebhookService } from './whatsapp-openwa-webhook.service';

@Controller('webhooks/openwa')
export class WhatsappOpenwaWebhookController {
  private readonly logger = new Logger(WhatsappOpenwaWebhookController.name);

  constructor(private readonly webhook: WhatsappOpenwaWebhookService) {}

  @Post()
  @HttpCode(200)
  async receive(@Req() req: Request & { rawBody?: Buffer }) {
    const signature =
      req.header('x-openwa-signature') || req.header('X-OpenWA-Signature');
    try {
      this.webhook.assertValidSignature(req.body, signature, req.rawBody);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid signature';
      throw new ForbiddenException(msg);
    }
    try {
      await this.webhook.handlePayload(req.body);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`OpenWA webhook handler failed: ${msg}`);
      throw new BadRequestException('Webhook processing failed');
    }
    return { ok: true };
  }
}
