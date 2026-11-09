// Phones talk through a free public MQTT relay, so the game needs no server of its own.
// The relay keeps the latest room message, which is what lets a phone rejoin after locking or reloading.
// Everything is encrypted with a key made from the room code, so the relay only sees scrambled bytes.
const BROKER = 'wss://broker.hivemq.com:8884/mqtt';
const ROOM_LIFETIME = 3 * 24 * 60 * 60; // seconds a quiet room stays on the relay
const enc = new TextEncoder();
const dec = new TextDecoder();

export const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I/L to mix up
export const CODE_LENGTH = 5;
export const makeCode = () => [...crypto.getRandomValues(new Uint8Array(CODE_LENGTH))].map((b) => CODE_LETTERS[b % CODE_LETTERS.length]).join('');
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);

let loading = null;
function loadClient() {
  if (window.mqtt) return Promise.resolve();
  loading ||= new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'vendor/mqtt.min.js';
    s.onload = ok;
    s.onerror = () => { loading = null; fail(new Error('relay client failed to load')); };
    document.head.append(s);
  });
  return loading;
}

const sha = (text) => crypto.subtle.digest('SHA-256', enc.encode(text));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

// handlers: onState(doc), onAsk(msg), onStatus(connected)
export async function openRoom(code, handlers) {
  await loadClient();
  const key = await crypto.subtle.importKey('raw', await sha(`polymono-manila:key:${code}`), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const base = `polymono-manila/v1/${hex(await sha(`polymono-manila:topic:${code}`)).slice(0, 32)}`;
  const STATE = `${base}/state`, ASK = `${base}/ask`;

  let client = null, closed = false, hiddenAt = 0;
  let inbox = Promise.resolve(); // decrypting is async; this keeps messages in arrival order

  async function seal(obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const body = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
    const out = new Uint8Array(12 + body.byteLength);
    out.set(iv); out.set(new Uint8Array(body), 12);
    return out;
  }
  async function unseal(bytes) {
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
    return JSON.parse(dec.decode(data));
  }

  function connect() {
    const c = mqtt.connect(BROKER, { protocolVersion: 5, clean: true, keepalive: 20, reconnectPeriod: 1500, connectTimeout: 8000, resubscribe: false });
    client = c;
    c.on('connect', () => { c.subscribe([STATE, ASK], { qos: 1 }); handlers.onStatus?.(true); });
    c.on('close', () => { if (c === client && !closed) handlers.onStatus?.(false); });
    c.on('error', () => {});
    c.on('message', (topic, payload) => {
      const bytes = new Uint8Array(payload);
      if (!bytes.length) return;
      inbox = inbox.then(async () => {
        let msg;
        try { msg = await unseal(bytes); } catch { return; } // not from this room
        if (closed) return;
        if (topic === STATE) handlers.onState(msg); else handlers.onAsk?.(msg);
      });
    });
  }

  // iPhones freeze sockets in the background, and a frozen one can still look open. Start fresh on return.
  function onVisibility() {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 3000) { const old = client; connect(); old.end(true); }
    hiddenAt = 0;
  }
  document.addEventListener('visibilitychange', onVisibility);
  connect();

  return {
    code,
    async state(obj) { client.publish(STATE, await seal(obj), { qos: 1, retain: true, properties: { messageExpiryInterval: ROOM_LIFETIME } }); },
    async ask(obj) { client.publish(ASK, await seal(obj), { qos: 0 }); },
    close() { closed = true; document.removeEventListener('visibilitychange', onVisibility); client.end(false); },
  };
}
