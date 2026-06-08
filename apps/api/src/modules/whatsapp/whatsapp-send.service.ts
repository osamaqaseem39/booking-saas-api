import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WhatsappSendService {
  private readonly logger = new Logger(WhatsappSendService.name);

  async sendText(input: {
    phoneNumberId: string;
    accessToken: string;
    toWaId: string;
    body: string;
  }): Promise<void> {
    const version = process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || 'v21.0';
    const url = `https://graph.facebook.com/${version}/${input.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: input.toWaId,
        type: 'text',
        text: { body: input.body },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const summary = detail.slice(0, 400);
      this.logger.warn(
        `WhatsApp send failed (${res.status}) phoneNumberId=${input.phoneNumberId}: ${summary}`,
      );
      throw new Error(`WhatsApp send failed (${res.status}): ${summary}`);
    }
  }
}
