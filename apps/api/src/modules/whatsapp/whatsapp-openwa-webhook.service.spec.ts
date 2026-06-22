import { createHmac } from 'crypto';
import { WhatsappOpenwaWebhookService } from './whatsapp-openwa-webhook.service';

describe('WhatsappOpenwaWebhookService', () => {
  const channels = {
    findByOpenWaSessionId: jest.fn(),
    touchWebhook: jest.fn(),
  };
  const bot = { handleInbound: jest.fn() };
  const dedup = { tryAcquire: jest.fn(), release: jest.fn() };
  const send = { sendForChannel: jest.fn() };

  let service: WhatsappOpenwaWebhookService;

  beforeEach(() => {
    jest.clearAllMocks();
    dedup.tryAcquire.mockResolvedValue(true);
    service = new WhatsappOpenwaWebhookService(
      channels as never,
      bot as never,
      dedup as never,
      send as never,
    );
  });

  it('assertValidSignature accepts valid HMAC from raw body', () => {
    const prev = process.env.OPENWA_WEBHOOK_SECRET;
    process.env.OPENWA_WEBHOOK_SECRET = 'openwa-secret';
    const raw = JSON.stringify({ event: 'message.received', sessionId: 'sess_1' });
    const sig =
      'sha256=' +
      createHmac('sha256', 'openwa-secret').update(raw).digest('hex');
    expect(() =>
      service.assertValidSignature(JSON.parse(raw), sig, raw),
    ).not.toThrow();
    process.env.OPENWA_WEBHOOK_SECRET = prev;
  });

  it('extractInboundMessage parses text messages', () => {
    expect(
      service.extractInboundMessage({
        event: 'message.received',
        sessionId: 'sess_abc',
        data: {
          id: 'msg-1',
          from: '923001234567@c.us',
          body: '  book padel  ',
          type: 'chat',
          isGroup: false,
        },
      }),
    ).toEqual({
      phoneNumberId: 'sess_abc',
      from: '923001234567',
      messageId: 'msg-1',
      kind: 'text',
      text: 'book padel',
    });
  });

  it('handlePayload routes to bot', async () => {
    channels.findByOpenWaSessionId.mockResolvedValue({
      id: 'ch-1',
      provider: 'openwa',
      botEnabled: true,
    });
    await service.handlePayload({
      event: 'message.received',
      sessionId: 'sess_abc',
      data: {
        id: 'msg-2',
        from: '923001234567@c.us',
        body: 'hi',
        type: 'chat',
        isGroup: false,
      },
    });
    expect(bot.handleInbound).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ch-1' }),
      '923001234567',
      'hi',
    );
  });
});
