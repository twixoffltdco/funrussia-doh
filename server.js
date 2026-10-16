/**
 * FUN RUSSIA — DNS-over-HTTPS (для Layero light / без UDP 53)
 * Production endpoint: https://funrussia-doh.layero.dev/dns-query
 * Game server: 185.207.214.14:7785
 * funrussia-online.tatnet.app is the website and must not be hijacked to the game IP.
 */
const express = require('express');
const dgram = require('dgram');
const dns2 = require('dns2');
const { Packet } = dns2;

const GAME_IP = process.env.GAME_IP || '185.207.214.14';
const PORT = Number(process.env.PORT || 3000);
const HIJACK = (process.env.HIJACK || 'blackrussia.online,br1.fun')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const UPSTREAM_DOH = process.env.UPSTREAM_DOH || 'https://cloudflare-dns.com/dns-query';

function shouldHijack(name) {
  const n = String(name || '').toLowerCase().replace(/\.$/, '');
  return HIJACK.some(s => n === s || n.endsWith('.' + s));
}

function buildAResponse(requestPacket, name) {
  const response = Packet.createResponseFromRequest(requestPacket);
  response.header.qr = 1;
  response.header.ra = 1;
  response.header.rd = 1;
  response.answers = [{
    name,
    type: Packet.TYPE.A,
    class: Packet.CLASS.IN,
    ttl: 30,
    address: GAME_IP,
  }];
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
    headers: {
      'content-type': 'application/dns-message',
      'accept': 'application/dns-message',
    },
    body: buf,
  });
  if (!r.ok) throw new Error('upstream ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

function handleDnsWire(buf) {
  let packet;
  try {
    packet = Packet.parse(buf);
  } catch {
    return null;
  }
  const q = packet.questions && packet.questions[0];
  if (!q) return null;
  const name = q.name;
  const qtype = q.type;

  if (shouldHijack(name) && qtype === Packet.TYPE.A) {
    console.log('[HIJACK A]', name, '->', GAME_IP);
    return buildAResponse(packet, name);
  }
  if (shouldHijack(name) && qtype === Packet.TYPE.AAAA) {
    console.log('[HIJACK AAAA]', name, 'empty');
    return buildEmptyResponse(packet);
  }
  return null; // forward
}

const app = express();
app.use(express.raw({ type: '*/*', limit: '64kb' }));

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html><meta charset=utf-8>
<title>FUN RUSSIA DNS</title>
<body style="font-family:system-ui;background:#0b0b0d;color:#fff;padding:2rem">
<h1>FUN RUSSIA DoH</h1>
<p>DNS-over-HTTPS для iOS. Endpoint: <code>/dns-query</code></p>
<p>Game IP: <b>${GAME_IP}</b></p>
<p>OK</p></body>`);
});

app.get('/health', (_req, res) => res.json({ ok: true, game: GAME_IP, hijack: HIJACK }));

// RFC 8484 GET ?dns=base64url
app.get('/dns-query', async (req, res) => {
  try {
    let buf;
    if (req.query.dns) {
      let b64 = String(req.query.dns).replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      buf = Buffer.from(b64, 'base64');
    } else if (req.query.name) {
      // convenience JSON-ish debug via wire build
      const name = String(req.query.name);
      const packet = new Packet();
      packet.header.id = 0x1234;
      packet.header.rd = 1;
      packet.questions = [{ name, type: Packet.TYPE.A, class: Packet.CLASS.IN }];
      buf = packet.toBuffer();
      const hijacked = handleDnsWire(buf);
      if (hijacked) {
        // for debug return json
        return res.json({ name, address: GAME_IP, hijacked: true });
      }
      return res.json({ name, hijacked: false, note: 'forward only via POST wire format' });
    } else {
      return res.status(400).send('need dns= or name=');
    }

    const hijacked = handleDnsWire(buf);
    const out = hijacked || await forwardDoH(buf);
    res.set('content-type', 'application/dns-message');
    res.send(out);
  } catch (e) {
    console.error(e);
    res.status(502).send('bad gateway');
  }
});

app.post('/dns-query', async (req, res) => {
  try {
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
    if (!buf.length) return res.status(400).send('empty');
    const hijacked = handleDnsWire(buf);
    const out = hijacked || await forwardDoH(buf);
    res.set('content-type', 'application/dns-message');
    res.send(out);
  } catch (e) {
    console.error(e);
    res.status(502).send('bad gateway');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('FUN RUSSIA DoH on :' + PORT);
  console.log('GAME_IP=' + GAME_IP);
  console.log('HIJACK=' + HIJACK.join(','));
});
