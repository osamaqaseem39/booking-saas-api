const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');

const API_PORT = Number(process.env.OPENWA_GATEWAY_PORT || 2785);
const DASHBOARD_PORT = Number(process.env.OPENWA_DASHBOARD_PORT || 2886);
const API_KEY = (process.env.OPENWA_API_KEY || 'dev-openwa-key').trim();
const MODE = (process.env.OPENWA_MODE || 'mock').trim().toLowerCase();
const DATA_DIR = process.env.OPENWA_DATA_DIR || path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'sessions.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

/** @type {Map<string, { id: string, label: string, status: string, webhooks: Array<{ url: string, events: string[], secret: string }>, client?: unknown }>} */
const sessions = new Map();
/** @type {Map<string, Promise<unknown>>} */
const starting = new Map();

function loadStore() {
  if (!fs.existsSync(STORE_PATH)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    for (const row of raw.sessions || []) {
      sessions.set(row.id, {
        id: row.id,
        label: row.label || row.id,
        status: row.status || 'pending',
        webhooks: row.webhooks || [],
      });
    }
  } catch {
    /* ignore corrupt store */
  }
}

function saveStore() {
  const payload = {
    sessions: [...sessions.values()].map((s) => ({
      id: s.id,
      label: s.label,
      status: s.status,
      webhooks: s.webhooks,
    })),
  };
  fs.writeFileSync(STORE_PATH, JSON.stringify(payload, null, 2));
}

function signPayload(secret, payload) {
  return (
    'sha256=' +
    crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex')
  );
}

async function deliverWebhooks(sessionId, payload) {
  const session = sessions.get(sessionId);
  if (!session) return;
  for (const hook of session.webhooks) {
    if (!hook.events.includes(payload.event)) continue;
    const headers = { 'Content-Type': 'application/json' };
    if (hook.secret) {
      headers['x-openwa-signature'] = signPayload(hook.secret, payload);
    }
    try {
      const res = await fetch(hook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.warn(
          `Webhook ${hook.url} failed (${res.status}): ${detail.slice(0, 200)}`,
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`Webhook ${hook.url} error: ${msg}`);
    }
  }
}

function requireApiKey(req, res, next) {
  const key = req.header('X-API-Key')?.trim();
  if (!key || key !== API_KEY) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }
  next();
}

function newSessionId() {
  return `sess_${crypto.randomBytes(8).toString('hex')}`;
}

async function startLiveSession(session) {
  if (MODE !== 'live') {
    session.status = 'connected';
    saveStore();
    return;
  }
  if (starting.has(session.id)) {
    await starting.get(session.id);
    return;
  }
  const job = (async () => {
    const { create } = await import('@open-wa/wa-automate');
    session.status = 'starting';
    saveStore();
    const client = await create({
      sessionId: session.id,
      multiDevice: true,
      headless: true,
      disableSpins: true,
      useChrome: true,
      qrTimeout: 0,
      authTimeout: 0,
      cacheEnabled: true,
      sessionDataPath: path.join(DATA_DIR, 'wa-sessions'),
    });
    session.client = client;
    session.status = 'connected';
    saveStore();
    await client.onMessage(async (msg) => {
      if (msg.isGroupMsg) return;
      await deliverWebhooks(session.id, {
        event: 'message.received',
        sessionId: session.id,
        idempotencyKey: msg.id,
        data: {
          id: msg.id,
          from: msg.from,
          chatId: msg.from,
          body: msg.body,
          type: msg.type || 'chat',
          isGroup: false,
        },
      });
    });
  })();
  starting.set(session.id, job);
  try {
    await job;
  } catch (e) {
    session.status = 'error';
    saveStore();
    throw e;
  } finally {
    starting.delete(session.id);
  }
}

function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, mode: MODE });
  });

  app.get('/api/sessions', requireApiKey, (_req, res) => {
    res.json({
      sessions: [...sessions.values()].map((s) => ({
        id: s.id,
        label: s.label,
        status: s.status,
        webhookCount: s.webhooks.length,
      })),
    });
  });

  app.post('/api/sessions', requireApiKey, async (req, res) => {
    const id = (req.body?.id || newSessionId()).trim();
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    if (sessions.has(id)) {
      res.status(409).json({ error: 'Session already exists' });
      return;
    }
    const session = {
      id,
      label: (req.body?.label || id).trim(),
      status: MODE === 'mock' ? 'connected' : 'pending',
      webhooks: [],
    };
    sessions.set(id, session);
    saveStore();
    if (MODE === 'live') {
      startLiveSession(session).catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Session ${id} start failed: ${msg}`);
      });
    }
    res.status(201).json({ id: session.id, status: session.status, mode: MODE });
  });

  app.get('/api/sessions/:sessionId', requireApiKey, (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({
      id: session.id,
      label: session.label,
      status: session.status,
      webhookCount: session.webhooks.length,
    });
  });

  app.post('/api/sessions/:sessionId/messages/send-text', requireApiKey, async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const chatId = String(req.body?.chatId || '').trim();
    const text = String(req.body?.text || '').trim();
    if (!chatId || !text) {
      res.status(400).json({ error: 'chatId and text are required' });
      return;
    }
    if (MODE === 'live') {
      if (!session.client) {
        res.status(409).json({ error: 'Session not connected yet' });
        return;
      }
      await session.client.sendText(chatId, text);
    } else {
      console.log(`[mock] send-text session=${session.id} chatId=${chatId} text=${text}`);
    }
    res.json({ ok: true });
  });

  app.post('/api/sessions/:sessionId/webhooks', requireApiKey, (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const url = String(req.body?.url || '').trim();
    const events = Array.isArray(req.body?.events) ? req.body.events.map(String) : [];
    const secret = String(req.body?.secret || '').trim();
    if (!url || events.length === 0) {
      res.status(400).json({ error: 'url and events are required' });
      return;
    }
    session.webhooks = session.webhooks.filter((h) => h.url !== url);
    session.webhooks.push({ url, events, secret });
    saveStore();
    res.status(201).json({ ok: true, webhookCount: session.webhooks.length });
  });

  app.post('/api/sessions/:sessionId/simulate-inbound', requireApiKey, async (req, res) => {
    if (MODE !== 'mock') {
      res.status(400).json({ error: 'Only available in mock mode' });
      return;
    }
    const session = sessions.get(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const from = String(req.body?.from || '923001234567').trim();
    const body = String(req.body?.body || 'hi').trim();
    const chatId = from.includes('@') ? from : `${from}@c.us`;
    const payload = {
      event: 'message.received',
      sessionId: session.id,
      idempotencyKey: `mock_${Date.now()}`,
      data: {
        id: `mock_${Date.now()}`,
        from: chatId,
        chatId,
        body,
        type: 'chat',
        isGroup: false,
      },
    };
    await deliverWebhooks(session.id, payload);
    res.json({ ok: true, payload });
  });

  return app;
}

function createDashboardApp() {
  const app = express();
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.get('/api/info', (_req, res) => {
    res.json({
      mode: MODE,
      apiPort: API_PORT,
      apiKeyConfigured: Boolean(API_KEY),
      sessions: [...sessions.values()].map((s) => ({
        id: s.id,
        label: s.label,
        status: s.status,
      })),
    });
  });
  return app;
}

loadStore();

for (const session of sessions.values()) {
  if (MODE === 'live' && session.status !== 'error') {
    startLiveSession(session).catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Restore session ${session.id} failed: ${msg}`);
    });
  } else if (MODE === 'mock') {
    session.status = 'connected';
  }
}

createApiApp().listen(API_PORT, () => {
  console.log(`OpenWA gateway API on :${API_PORT} (mode=${MODE})`);
});

createDashboardApp().listen(DASHBOARD_PORT, () => {
  console.log(`OpenWA dashboard on :${DASHBOARD_PORT}`);
});
