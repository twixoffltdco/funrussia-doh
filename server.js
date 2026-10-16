const express = require('express');
const dns2 = require('dns2');
const { Packet } = dns2;

const GAME_IP = process.env.GAME_IP || '185.207.214.14';
const PORT = Number(process.env.PORT || 3000);
const UPSTREAM_DOH = process.env.UPSTREAM_DOH || 'https://cloudflare-dns.com/dns-query';
const DNS_DIAGNOSTICS = !['0', 'false', 'off'].includes(String(process.env.DNS_DIAGNOSTICS || '1').toLowerCase());

// Safe default: never redirect official Black Russia domains.
// Add only a confirmed game-only hostname to HIJACK after reviewing logs.
const BLOCKED_HIJACK_HOSTS = new Set(['blackrussia.online', 'br1.fun']);
const HIJACK = (process.env.HIJACK || '')
  .split(',')
  .map(s => s.trim().toLowerCase().replace(/\.$/, ''))
  .filter(s => Boolean(s) && !BLOCKED_HIJACK_HOSTS.has(s));

function shouldHijack(name) {
  const n = String(name || '').toLowerCase().replace(/\.$/, '');
  return HIJACK.includes(n); // exact host only
}

function typeName(type) {
  return Object.keys(Packet.TYPE).find(k => Packet.TYPE[k] === type) || String(type);
}

function inspectQuery(buf) {
  try {
    const packet = Packet.parse(buf);
    const q = packet.questions && packet.questions[0];
    if (!q) return null;
    return { name: String(q.name || '').toLowerCase().replace(/\.$/, ''), type: q.type, typeLabel: typeName(q.type) };
  } catch {
    return null;
  }
}

function logQuery(buf, action) {
  if (!DNS_DIAGNOSTICS) return;
  const q = inspectQuery(buf);
  if (q) console.log(`[DNS] ${q.name} type=${q.typeLabel} action=${action}`);
}

function buildAResponse(requestPacket, name) {
  const response = Packet.createResponseFromRequest(requestPacket);
  response.header.qr = 1;
  response.header.ra = 1;
  response.header.rd = 1;
  response.answers = [{ name, type: Packet.TYPE.A, class: Packet.CLASS.IN, ttl: 30, address: GAME_IP }];
  return response.toBuffer();
}

function buildEmptyResponse(requestPacket) {
  const response = Packet.createResponseFromRequest(requestPacket);
  response.header.qr = 1;
  response.header.ra = 1;
  response.answers = [];
  return response.toBuffer();
}

async function forwardDoH(buf) {
  const r = await fetch(UPSTREAM_DOH, {
    method: 'POST',
    headers: { 'content-type': 'application/dns-message', 'accept': 'application/dns-message' },
    body: buf,
  });
  if (!r.ok) throw new Error('upstream ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

function handleDnsWire(buf) {
  let packet;
  try { packet = Packet.parse(buf); } catch { return null; }
  const q = packet.questions && packet.questions[0];
  if (!q) return null;

  if (shouldHijack(q.name) && q.type === Packet.TYPE.A) {
    logQuery(buf, `HIJACK->${GAME_IP}`);
    return buildAResponse(packet, q.name);
  }
  if (shouldHijack(q.name) && q.type === Packet.TYPE.AAAA) {
    logQuery(buf, 'HIJACK-AAAA-empty');
    return buildEmptyResponse(packet);
  }
  logQuery(buf, 'UPSTREAM');
  return null;
}

const app = express();
app.use(express.raw({ type: '*/*', limit: '64kb' }));

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html><meta charset=utf-8>
<title>FUN RUSSIA DNS</title>
<body style="font-family:system-ui;background:#0b0b0d;color:#fff;padding:2rem">
<h1>FUN RUSSIA DoH</h1><p>DNS-over-HTTPS endpoint: <code>/dns-query</code></p>
<p>Game server: <b>${GAME_IP}:7785</b></p>
<p>Hijack hosts: <b>${HIJACK.length ? HIJACK.join(', ') : 'none (safe default)'}</b></p>
<p>DNS diagnostics: <b>${DNS_DIAGNOSTICS ? 'enabled; see deployment logs' : 'disabled'}</b></p><p>OK</p></body>`);
});

app.get('/health', (_req, res) => res.json({ ok: true, game: GAME_IP, hijack: HIJACK, dnsDiagnostics: DNS_DIAGNOSTICS }));

app.get('/dns-query', async (req, res) => {
  try {
    let buf;
    if (req.query.dns) {
      let b64 = String(req.query.dns).replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      buf = Buffer.from(b64, 'base64');
    } else if (req.query.name) {
      const name = String(req.query.name);
      const packet = new Packet();
      packet.header.id = 0x1234;
      packet.header.rd = 1;
      packet.questions = [{ name, type: Packet.TYPE.A, class: Packet.CLASS.IN }];
      const hijacked = handleDnsWire(packet.toBuffer());
      if (hijacked) return res.json({ name, address: GAME_IP, hijacked: true });
      return res.json({ name, hijacked: false, note: 'Normal DNS is forwarded through upstream DoH.' });
    } else {
      return res.status(400).send('need dns= or name=');
    }
    const hijacked = handleDnsWire(buf);
    const result = hijacked || await forwardDoH(buf);
    res.set('content-type', 'application/dns-message');
    res.send(result);
  } catch (e) {
    console.error('[DoH error]', e && e.message ? e.message : e);
    res.status(502).send('bad gateway');
  }
});

app.post('/dns-query', async (req, res) => {
  try {
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
    if (!buf.length) return res.status(400).send('empty');
    const hijacked = handleDnsWire(buf);
    const result = hijacked || await forwardDoH(buf);
    res.set('content-type', 'application/dns-message');
    res.send(result);
  } catch (e) {
    console.error('[DoH error]', e && e.message ? e.message : e);
    res.status(502).send('bad gateway');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FUN RUSSIA DoH listening on :${PORT}`);
  console.log(`GAME_IP=${GAME_IP}`);
  console.log(`HIJACK=${HIJACK.join(',') || '(disabled; safe default)'}`);
  console.log(`DNS_DIAGNOSTICS=${DNS_DIAGNOSTICS}`);
});
