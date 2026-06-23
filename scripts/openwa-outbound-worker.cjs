/**
 * Polls production API for pending outbound WhatsApp messages and sends via local OpenWA.
 *
 * Usage:
 *   OPENWA_WORKER_KEY=your-key API_BASE=https://booking-saas-api-lilac.vercel.app node scripts/openwa-outbound-worker.cjs
 */
const API_BASE = (process.env.API_BASE || 'https://booking-saas-api-lilac.vercel.app').replace(
  /\/$/,
  '',
);
const WORKER_KEY = (process.env.OPENWA_WORKER_KEY || 'dev-openwa-worker').trim();
const OPENWA_LOCAL = (process.env.OPENWA_LOCAL_URL || 'http://127.0.0.1:2785').replace(
  /\/$/,
  '',
);
const POLL_MS = Number(process.env.OPENWA_WORKER_POLL_MS || 3000);

async function pollOnce() {
  const res = await fetch(`${API_BASE}/whatsapp/worker/outbound-pending`, {
    headers: { 'X-OpenWA-Worker-Key': WORKER_KEY },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.warn(`poll failed (${res.status}): ${detail.slice(0, 200)}`);
    return;
  }
  const data = await res.json();
  for (const item of data.items || []) {
    const { message, channel } = item;
    const base = (channel.openwaApiBaseUrl || OPENWA_LOCAL).replace(/\/$/, '');
    const url = `${base}/api/sessions/${encodeURIComponent(channel.phoneNumberId)}/messages/send-text`;
    const chatId = message.customerWaId.includes('@')
      ? message.customerWaId
      : `${message.customerWaId}@c.us`;
    try {
      const sendRes = await fetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': channel.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, text: message.body }),
      });
      if (!sendRes.ok) {
        const detail = await sendRes.text().catch(() => '');
        await fetch(`${API_BASE}/whatsapp/worker/messages/${message.id}/failed`, {
          method: 'POST',
          headers: {
            'X-OpenWA-Worker-Key': WORKER_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: detail.slice(0, 400) }),
        });
        console.warn(`send failed ${message.id}: ${detail.slice(0, 120)}`);
        continue;
      }
      await fetch(`${API_BASE}/whatsapp/worker/messages/${message.id}/sent`, {
        method: 'POST',
        headers: { 'X-OpenWA-Worker-Key': WORKER_KEY },
      });
      console.log(`sent ${message.id} -> ${chatId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await fetch(`${API_BASE}/whatsapp/worker/messages/${message.id}/failed`, {
        method: 'POST',
        headers: {
          'X-OpenWA-Worker-Key': WORKER_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: msg }),
      });
      console.warn(`send error ${message.id}: ${msg}`);
    }
  }
}

console.log(`OpenWA outbound worker → API ${API_BASE} · OpenWA ${OPENWA_LOCAL}`);
setInterval(() => void pollOnce(), POLL_MS);
void pollOnce();
