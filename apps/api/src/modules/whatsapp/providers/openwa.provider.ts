import { Injectable, Logger } from '@nestjs/common';
import { toOpenWaChatId } from '../utils/whatsapp-wa-id.util';

@Injectable()
export class OpenwaProvider {
  private readonly logger = new Logger(OpenwaProvider.name);

  private baseUrl(): string {
    return (process.env.OPENWA_BASE_URL?.trim() || 'http://localhost:2785').replace(
      /\/$/,
      '',
    );
  }

  private resolveApiKey(accessToken?: string): string {
    const token = accessToken?.trim() || process.env.OPENWA_API_KEY?.trim();
    if (!token) {
      throw new Error('OpenWA API key is not configured');
    }
    return token;
  }

  async sendText(input: {
    sessionId: string;
    accessToken?: string;
    toWaId: string;
    body: string;
  }): Promise<void> {
    const apiKey = this.resolveApiKey(input.accessToken);
    const url = `${this.baseUrl()}/api/sessions/${encodeURIComponent(input.sessionId)}/messages/send-text`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatId: toOpenWaChatId(input.toWaId),
        text: input.body,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const summary = detail.slice(0, 400);
      this.logger.warn(
        `OpenWA send failed (${res.status}) sessionId=${input.sessionId}: ${summary}`,
      );
      throw new Error(`OpenWA send failed (${res.status}): ${summary}`);
    }
  }

  async registerWebhook(input: {
    sessionId: string;
    accessToken?: string;
    url: string;
    secret: string;
  }): Promise<void> {
    const apiKey = this.resolveApiKey(input.accessToken);
    const endpoint = `${this.baseUrl()}/api/sessions/${encodeURIComponent(input.sessionId)}/webhooks`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: input.url,
        events: ['message.received'],
        secret: input.secret,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `OpenWA webhook registration failed (${res.status}): ${detail.slice(0, 400)}`,
      );
    }
  }
}
