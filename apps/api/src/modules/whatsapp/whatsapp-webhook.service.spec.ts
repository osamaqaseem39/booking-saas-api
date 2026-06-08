import { createHmac } from 'crypto';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

describe('WhatsappWebhookService', () => {
  const channels = { findByPhoneNumberId: jest.fn(), touchWebhook: jest.fn() };
  const bot = { handleInbound: jest.fn() };
  const dedup = { tryAcquire: jest.fn(), release: jest.fn() };
  const send = { sendText: jest.fn() };

  let service: WhatsappWebhookService;

  beforeEach(() => {
    jest.clearAllMocks();
    dedup.tryAcquire.mockResolvedValue(true);
    service = new WhatsappWebhookService(
      channels as never,
      bot as never,
      dedup as never,
      send as never,
    );
  });

  it('verifySubscribe returns challenge when token matches', () => {
    const prev = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'secret-token';
    expect(
      service.verifySubscribe({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'secret-token',
        'hub.challenge': '12345',
      }),
    ).toBe('12345');
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = prev;
  });

  it('assertValidSignature accepts valid HMAC', () => {
    const prev = process.env.WHATSAPP_APP_SECRET;
    process.env.WHATSAPP_APP_SECRET = 'app-secret';
    const body = Buffer.from('{"hello":"world"}');
    const sig =
      'sha256=' + createHmac('sha256', 'app-secret').update(body).digest('hex');
    expect(() => service.assertValidSignature(body, sig)).not.toThrow();
    process.env.WHATSAPP_APP_SECRET = prev;
  });

  it('assertValidSignature rejects invalid HMAC', () => {
    const prev = process.env.WHATSAPP_APP_SECRET;
    process.env.WHATSAPP_APP_SECRET = 'app-secret';
    expect(() =>
      service.assertValidSignature(Buffer.from('{}'), 'sha256=deadbeef'),
    ).toThrow('Invalid WhatsApp webhook signature');
    process.env.WHATSAPP_APP_SECRET = prev;
  });

  it('extractInboundMessages parses text and unsupported messages', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'pn-1' },
                messages: [
                  {
                    id: 'wamid.text',
                    from: '923001234567',
                    type: 'text',
                    text: { body: '  hello  ' },
                  },
                  {
                    id: 'wamid.image',
                    from: '923001234567',
                    type: 'image',
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(service.extractInboundMessages(payload)).toEqual([
      {
        phoneNumberId: 'pn-1',
        from: '923001234567',
        messageId: 'wamid.text',
        kind: 'text',
        text: 'hello',
      },
      {
        phoneNumberId: 'pn-1',
        from: '923001234567',
        messageId: 'wamid.image',
        kind: 'unsupported',
      },
    ]);
  });

  it('handlePayload skips duplicate messageId', async () => {
    dedup.tryAcquire.mockResolvedValue(false);
    channels.findByPhoneNumberId.mockResolvedValue({
      id: 'ch-1',
      phoneNumberId: 'pn-1',
      accessToken: 'tok',
      botEnabled: true,
    });
    await service.handlePayload({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'pn-1' },
                messages: [
                  {
                    id: 'wamid.dup',
                    from: '92300',
                    type: 'text',
                    text: { body: 'hi' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(bot.handleInbound).not.toHaveBeenCalled();
  });
});
